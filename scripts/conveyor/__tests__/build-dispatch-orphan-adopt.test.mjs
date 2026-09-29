/**
 * @file build-dispatch-orphan-adopt.test.mjs — #4131/#4382 build-orphan-adopt.
 *
 * PURE CORE first (classify/decide, no fs/process at all), then `checkResumable`'s own safety check, then the
 * orchestration (`adoptOrphanedBuildClaims`) against REAL claim/resume-marker lock roots (same primitive the
 * codebase already trusts — `build-dispatch-claim.test.mjs`) with every OTHER effect (run-store row lookup,
 * resumability check, the resume spawn itself, the pid probe) injected — so this suite never spawns a real
 * detached process, never shells `lane-pool.mjs`, and never depends on a real delivery-report sidecar on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyClaimLiveness, decideOrphanAction, findLatestBuildRow, adoptOrphanedBuildClaims, checkResumable,
} from '../build-dispatch-orphan-adopt.mjs';
import {
  acquireBuildDispatchClaim, listBuildDispatchClaims, releaseBuildDispatchClaim,
  markBuildDispatchResume, readBuildDispatchResume,
} from '../build-dispatch-claim.mjs';

describe('classifyClaimLiveness — pure', () => {
  const inFlightRow = (handle) => ({ runId: 'dispatch-lane-x', entry: { status: 'in-flight', handle, payload: { lane: 3, sessionSlug: 's' } } });
  const settledRow = (outcome, pr) => ({ runId: 'dispatch-lane-x', entry: { status: 'applied', result: { outcome, pr }, payload: { lane: 3, sessionSlug: 's' } } });

  it('alive: the dispatch row\'s own pid answers alive, no resume marker', () => {
    const isPidAlive = (pid) => pid === 111;
    expect(classifyClaimLiveness({ row: inFlightRow('pid:111'), resumeMarker: null, isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('dead: the dispatch row\'s own pid is confirmed gone by the kernel', () => {
    const isPidAlive = () => false;
    expect(classifyClaimLiveness({ row: inFlightRow('pid:111'), resumeMarker: null, isPidAlive })).toMatchObject({ status: 'dead' });
  });

  it('no-record: no row at all, no resume marker, and no owner pid given — too early to judge', () => {
    expect(classifyClaimLiveness({ row: null, resumeMarker: null, isPidAlive: () => true })).toMatchObject({ status: 'no-record' });
  });

  // #4382 shape (live 2026-09-29): killed before the dispatch ever reached `in-flight` — NO run-store row
  // exists at all. The claim's own OWNER pid (the dispatching daemon's pid at claim time) is the only other
  // liveness signal available; when it too is confirmed dead, nothing is watching this claim any more.
  it('#4382 shape: no row at all, but the claim\'s OWN owner pid is confirmed dead → dead (orphaned)', () => {
    const isPidAlive = (pid) => pid !== 98761;
    expect(classifyClaimLiveness({ row: null, resumeMarker: null, ownerPid: 98761, isPidAlive })).toMatchObject({ status: 'dead', row: null });
  });

  it('no row, but the claim\'s owner pid IS alive → no-record (the claim was likely just taken; too early)', () => {
    const isPidAlive = (pid) => pid === 98761;
    expect(classifyClaimLiveness({ row: null, resumeMarker: null, ownerPid: 98761, isPidAlive })).toMatchObject({ status: 'no-record' });
  });

  it('a handle-less declared/pending row (killed before a handle was ever recorded) falls back to the owner '
    + 'pid exactly like no row at all', () => {
    const pendingRow = { runId: 'dispatch-lane-x', entry: { status: 'pending', handle: null, payload: { lane: 3, sessionSlug: 's' } } };
    const isPidAlive = () => false;
    expect(classifyClaimLiveness({ row: pendingRow, resumeMarker: null, ownerPid: 1, isPidAlive })).toMatchObject({ status: 'dead' });
  });

  // #4131 shape (live 2026-09-29): the wrapper's own exit path settled `applied` as `pr-opened`, but the PR
  // number came back null — nothing was actually delivered, and `doneWhy` never revisits a `pr-opened` settle.
  it('#4131 shape: settled `pr-opened` with NO confirmed pr → dead (nothing was actually delivered)', () => {
    expect(classifyClaimLiveness({ row: settledRow('pr-opened', null), resumeMarker: null, isPidAlive: () => true }))
      .toMatchObject({ status: 'dead' });
  });

  it('settled `pr-opened` WITH a real pr number → settled-elsewhere (doneWhy\'s own PR-observed path owns it)', () => {
    expect(classifyClaimLiveness({ row: settledRow('pr-opened', 2921), resumeMarker: null, isPidAlive: () => true }))
      .toMatchObject({ status: 'settled-elsewhere' });
  });

  it('settled with any OTHER outcome (gate-red, not-ready, wrapper-threw, …) → settled-elsewhere — that is '
    + '`doneWhy`\'s own job, never this module\'s to re-decide', () => {
    for (const outcome of ['gate-red', 'not-ready', 'wrapper-threw', 'blocked-mid-build']) {
      expect(classifyClaimLiveness({ row: settledRow(outcome, null), resumeMarker: null, isPidAlive: () => true }))
        .toMatchObject({ status: 'settled-elsewhere' });
    }
  });

  it('a LIVE resume marker overrides the original (now-irrelevant) dispatch row\'s own dead pid', () => {
    const isPidAlive = (pid) => pid === 222; // only the RESUME's pid answers alive
    const marker = { pid: 222, meta: { pid: 222 } };
    expect(classifyClaimLiveness({ row: inFlightRow('pid:111'), resumeMarker: marker, isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('a DEAD resume marker (the resume attempt itself died) reports dead, not the original row\'s pid', () => {
    const isPidAlive = () => false;
    const marker = { pid: 222, meta: { pid: 222 } };
    expect(classifyClaimLiveness({ row: inFlightRow('pid:111'), resumeMarker: marker, isPidAlive })).toMatchObject({ status: 'dead' });
  });
});

describe('decideOrphanAction — pure', () => {
  it('resumable → resume', () => {
    expect(decideOrphanAction({ resumable: true }).action).toBe('resume');
  });
  it('not resumable → release', () => {
    expect(decideOrphanAction({ resumable: false }).action).toBe('release');
  });
});

describe('findLatestBuildRow — pure', () => {
  const buildEffect = (num, status, startedAt, handle, result = null) => ({
    type: 'conveyor.dispatch-delivery-agent', status, startedAt, handle, result,
    payload: { num, launchKind: 'build', lane: 3, sessionSlug: `conveyor-${num}` },
  });

  it('picks the newest row for the item BY STATUS-AGNOSTIC startedAt, ignoring other items — a SETTLED row '
    + 'newer than an in-flight one wins (the #4131 shape: the wrapper settled after going in-flight)', () => {
    const runs = [
      { id: 'dispatch-lane-a', record: { effects: [buildEffect('4131', 'in-flight', '2026-09-29T10:46:00Z', 'pid:1')] } },
      { id: 'dispatch-lane-b', record: { effects: [buildEffect('4131', 'in-flight', '2026-09-29T11:00:00Z', 'pid:2')] } },
      { id: 'dispatch-lane-c', record: { effects: [buildEffect('4131', 'applied', '2026-09-29T12:00:00Z', 'pid:3', { outcome: 'pr-opened', pr: null })] } },
      { id: 'dispatch-lane-d', record: { effects: [buildEffect('9999', 'in-flight', '2026-09-29T13:00:00Z', 'pid:4')] } },
    ];
    const row = findLatestBuildRow(runs, '4131');
    expect(row).toMatchObject({ runId: 'dispatch-lane-c', entry: { handle: 'pid:3', result: { outcome: 'pr-opened' } } });
  });

  it('returns null when nothing matches at all', () => {
    expect(findLatestBuildRow([], '4131')).toBeNull();
  });
});

describe('checkResumable — the lane-lease-currency safety check', () => {
  const alwaysDone = () => ({ status: 'done' });
  const alwaysAhead = () => true;

  it('resumable when the lane is STILL leased under the exact matching session, a done report exists, and '
    + 'the lane has a commit ahead of base', () => {
    const result = checkResumable({
      lane: 9, sessionSlug: 'conveyor-4131',
      currentLaneSession: () => 'conveyor-4131',
      resolveLane: () => '/fake/lane-9',
      readReport: alwaysDone,
      isLaneCommitAhead: alwaysAhead,
    });
    expect(result).toEqual({ resumable: true, lanePath: '/fake/lane-9' });
  });

  // THE SAFETY FIX (live 2026-09-29): #4131's own lane (8) was recycled twice in the hours between its
  // wrapper settling and this fix landing. Trusting "lane 8 has a commit ahead of main" without first
  // checking WHO currently holds the lease would resume from a completely unrelated occupant's own work.
  it('NOT resumable when the lane\'s lease has moved on to a different session — checked BEFORE any git read', () => {
    let gitRead = false;
    const result = checkResumable({
      lane: 8, sessionSlug: 'conveyor-4131',
      currentLaneSession: () => 'conveyor-4068', // a LATER, unrelated item now holds lane 8
      resolveLane: () => '/fake/lane-8',
      readReport: alwaysDone,
      isLaneCommitAhead: () => { gitRead = true; return true; },
    });
    expect(result).toEqual({ resumable: false, reason: 'lane-lease-moved-on' });
    expect(gitRead).toBe(false);
  });

  it('NOT resumable when the lane is not leased at all any more', () => {
    const result = checkResumable({
      lane: 8, sessionSlug: 'conveyor-4131',
      currentLaneSession: () => null,
      resolveLane: () => '/fake/lane-8',
      readReport: alwaysDone,
      isLaneCommitAhead: alwaysAhead,
    });
    expect(result).toEqual({ resumable: false, reason: 'lane-lease-moved-on' });
  });

  it('NOT resumable with no lane or session at all', () => {
    expect(checkResumable({ lane: null, sessionSlug: null })).toEqual({ resumable: false, reason: 'no-lane-or-session' });
  });

  it('NOT resumable when the lease matches but there is no done report', () => {
    const result = checkResumable({
      lane: 9, sessionSlug: 'conveyor-4131',
      currentLaneSession: () => 'conveyor-4131',
      resolveLane: () => '/fake/lane-9',
      readReport: () => null,
      isLaneCommitAhead: alwaysAhead,
    });
    expect(result).toMatchObject({ resumable: false, reason: 'no-done-report' });
  });

  it('NOT resumable when the lease and report match but the lane holds no commit ahead of base', () => {
    const result = checkResumable({
      lane: 9, sessionSlug: 'conveyor-4131',
      currentLaneSession: () => 'conveyor-4131',
      resolveLane: () => '/fake/lane-9',
      readReport: alwaysDone,
      isLaneCommitAhead: () => false,
    });
    expect(result).toMatchObject({ resumable: false, reason: 'no-commit-ahead' });
  });
});

describe('adoptOrphanedBuildClaims — orchestration over a real claim/resume lock root', () => {
  // TWO separate roots, matching production (`build-dispatch-claim.mjs`'s own `buildDispatchClaimRoot()` vs
  // `buildDispatchResumeRoot()` are distinct subdirectories under the same coordination root) — a claim and a
  // resume marker for the SAME item must never share one lock directory, or marking/refreshing one would
  // delete the other (`markBuildDispatchResume`'s own unconditional `releaseLockDir` refresh).
  let lockRoot;
  let resumeRoot;
  beforeEach(() => {
    lockRoot = mkdtempSync(join(tmpdir(), 'bdd-orphan-claims-'));
    resumeRoot = mkdtempSync(join(tmpdir(), 'bdd-orphan-resumes-'));
  });
  afterEach(() => {
    rmSync(lockRoot, { recursive: true, force: true });
    rmSync(resumeRoot, { recursive: true, force: true });
  });

  const buildRow = ({ num, handle, status = 'in-flight', result = null, lane = 3, sessionSlug = `conveyor-${num}` }) => ({
    runId: 'dispatch-lane-x',
    entry: { key: 'step:1:0', status, handle, result, payload: { num, launchKind: 'build', lane, sessionSlug, scope: [] } },
  });

  it('LEAVES a claim whose recorded dispatch is still alive', async () => {
    acquireBuildDispatchClaim({ num: '4295', scope: [], lockRoot, pid: 17711 });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: () => true,
      findRow: () => buildRow({ num: '4295', handle: 'pid:999' }),
      readResumeMarker: () => null,
      resolveResumability: () => { throw new Error('must not be called when alive'); },
      releaseClaim: () => { throw new Error('must not release'); },
      releaseResumeMarker: () => {},
      settleRow: () => { throw new Error('must not settle'); },
      spawnResume: () => { throw new Error('must not spawn'); },
      markResume: () => { throw new Error('must not mark'); },
    });
    expect(results).toEqual([{ num: '4295', action: 'leave', reason: 'alive' }]);
    // the claim itself is untouched — still there.
    expect(listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }).map((c) => c.meta.num)).toEqual(['4295']);
  });

  it('RESUMES a dead-wrapper claim whose report + lane commit are still there — the general resumable shape: '
    + 'claim stays held, a fresh detached resume is spawned, and a resume marker records its pid', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot, pid: 74142 });
    let spawnedWith = null;
    let markedWith = null;
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: () => false, // the daemon-owner pid the claim was minted under is long dead
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142', lane: 9, sessionSlug: 'conveyor-4131' }),
      readResumeMarker: () => null,
      resolveResumability: ({ lane, sessionSlug }) => {
        expect(lane).toBe(9);
        expect(sessionSlug).toBe('conveyor-4131');
        return { resumable: true, lanePath: '/fake/lane-9' };
      },
      releaseClaim: () => { throw new Error('must not release a resumable orphan'); },
      releaseResumeMarker: () => {},
      settleRow: () => { throw new Error('must not settle the original row on a resume'); },
      spawnResume: (o) => { spawnedWith = o; return 55555; },
      markResume: (o) => { markedWith = o; },
    });
    expect(results).toEqual([{ num: '4131', action: 'resume', reason: expect.stringContaining('resumable'), pid: 55555 }]);
    expect(spawnedWith).toMatchObject({ num: '4131', lane: 9, sessionSlug: 'conveyor-4131' });
    expect(markedWith).toEqual({ num: '4131', pid: 55555 });
    // THE POINT: the claim is STILL held — never released while a resume is legitimately in flight.
    expect(listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }).map((c) => c.meta.num)).toEqual(['4131']);
  });

  it('RELEASES a dead-wrapper claim with nothing resumable — general shape: claim freed, NO hold, stale '
    + 'run-store row settled', async () => {
    acquireBuildDispatchClaim({ num: '4382', scope: [], lockRoot, pid: 98761 });
    let settledWith = null;
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4382', handle: 'pid:98761' }),
      readResumeMarker: () => null,
      resolveResumability: () => ({ resumable: false, reason: 'no-done-report' }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      releaseResumeMarker: () => {},
      settleRow: (o) => { settledWith = o; },
      spawnResume: () => { throw new Error('must not spawn when nothing is resumable'); },
      markResume: () => { throw new Error('must not mark when nothing is resumable'); },
    });
    expect(results).toEqual([{ num: '4382', action: 'release', reason: expect.stringContaining('no-done-report') }]);
    expect(settledWith).toEqual({ runId: 'dispatch-lane-x', key: 'step:1:0' });
    // THE POINT: the claim is GONE — the very next tick can offer #4382 for a completely fresh dispatch.
    expect(listBuildDispatchClaims({ lockRoot, ignoreExpiry: true })).toEqual([]);
  });

  // #4382's EXACT live shape: no run-store row was EVER found (killed before it ever went in-flight) — the
  // ORIGINAL version of this module left a claim like this alone forever (`no-record` → leave). The owner
  // pid's own death is what tells the two cases apart.
  it('#4382 EXACT shape: NO run-store row at all, but the claim\'s own owner pid is dead → RELEASES it '
    + '(never left stuck forever)', async () => {
    acquireBuildDispatchClaim({ num: '4382', scope: [], lockRoot, pid: 98761 });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: (pid) => pid !== 98761, // the claim's own owner (the daemon that took it) is dead
      findRow: () => null, // no run-store trace was ever found
      readResumeMarker: () => null,
      resolveResumability: (o) => { expect(o).toEqual({ lane: undefined, sessionSlug: undefined }); return { resumable: false, reason: 'no-lane-or-session' }; },
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      releaseResumeMarker: () => {},
      settleRow: () => { throw new Error('must not settle — there is no row to settle'); },
      spawnResume: () => { throw new Error('must not spawn — nothing to resume from'); },
      markResume: () => { throw new Error('must not mark'); },
    });
    expect(results).toEqual([{ num: '4382', action: 'release', reason: expect.stringContaining('no-lane-or-session') }]);
    expect(listBuildDispatchClaims({ lockRoot, ignoreExpiry: true })).toEqual([]);
  });

  it('a claim with no run-store row whose owner pid is STILL ALIVE is left alone — too early to tell (the '
    + 'daemon may have only just taken it)', async () => {
    acquireBuildDispatchClaim({ num: '4382', scope: [], lockRoot, pid: 98761 });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: (pid) => pid === 98761,
      findRow: () => null,
      readResumeMarker: () => null,
    });
    expect(results).toEqual([{ num: '4382', action: 'leave', reason: 'no-record' }]);
    expect(listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }).map((c) => c.meta.num)).toEqual(['4382']);
  });

  // #4131's own TTL-expiry gap (live 2026-09-29): the claim aged out of the ORDINARY (expiry-filtered) read
  // while the daemon was down for hours — `listClaims`'s own default now reads with `ignoreExpiry: true` for
  // exactly this reason. Proven here against a REAL expired claim on disk.
  it('adopts an EXPIRED claim too — the default `listClaims` reads past the TTL filter', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot, pid: 74142, leaseMinutes: 240 });
    // Simulate the claim having aged out by reading the SAME root at nowMs far past the TTL, exactly as
    // `adoptOrphanedBuildClaims`'s own default `listClaims` (`ignoreExpiry: true`) would.
    const past = Date.now() + 300 * 60_000;
    expect(listBuildDispatchClaims({ lockRoot, nowMs: past })).toEqual([]); // the ORDINARY read: invisible.
    expect(listBuildDispatchClaims({ lockRoot, nowMs: past, ignoreExpiry: true })).toHaveLength(1); // adoption's own read: still there.
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, nowMs: past, ignoreExpiry: true }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => null,
      resolveResumability: () => ({ resumable: false, reason: 'lane-lease-moved-on' }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      releaseResumeMarker: () => {},
      settleRow: () => {},
    });
    expect(results).toEqual([{ num: '4131', action: 'release', reason: expect.stringContaining('lane-lease-moved-on') }]);
  });

  it('LEAVES alone once a resume is already under way (a live resume marker) — never double-resumes', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot, pid: 74142 });
    markBuildDispatchResume({ num: '4131', pid: 55555, lockRoot: resumeRoot });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: (pid) => pid === 55555, // the resume's own pid is alive; the original dispatch's pid never asked
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => { throw new Error('must not re-check resumability while a resume is alive'); },
      releaseClaim: () => { throw new Error('must not release'); },
      releaseResumeMarker: () => {},
      settleRow: () => { throw new Error('must not settle'); },
      spawnResume: () => { throw new Error('must not spawn a second resume'); },
      markResume: () => { throw new Error('must not re-mark'); },
    });
    expect(results).toEqual([{ num: '4131', action: 'leave', reason: 'alive' }]);
  });

  it('LEAVES a claim already settled to a non-`pr-opened` outcome — `doneWhy`\'s own job, never contested here', async () => {
    acquireBuildDispatchClaim({ num: '4295', scope: [], lockRoot, pid: 17711 });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot, ignoreExpiry: true }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4295', handle: 'pid:17711', status: 'applied', result: { outcome: 'gate-red' } }),
      readResumeMarker: () => null,
      resolveResumability: () => { throw new Error('must not check resumability for a settled-elsewhere row'); },
      releaseClaim: () => { throw new Error('must not release — doneWhy owns this'); },
    });
    expect(results).toEqual([{ num: '4295', action: 'leave', reason: 'settled-elsewhere' }]);
  });

  it('ignores a non-`build`-kind claim entirely (never reached, but defensive)', async () => {
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => [{ owner: 'x', meta: { num: '1', kind: 'not-build' } }],
      isPidAlive: () => { throw new Error('must never be consulted for a non-build claim'); },
    });
    expect(results).toEqual([]);
  });
});
