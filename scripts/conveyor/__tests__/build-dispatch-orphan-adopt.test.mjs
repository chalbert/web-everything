/**
 * @file build-dispatch-orphan-adopt.test.mjs — #4131/#4382 build-orphan-adopt.
 *
 * PURE CORE first (classify/decide, no fs/process at all), then the orchestration (`adoptOrphanedBuildClaims`)
 * against REAL claim/resume-marker lock roots (same primitive the codebase already trusts —
 * `build-dispatch-claim.test.mjs`) with every OTHER effect (run-store row lookup, resumability check, the
 * resume spawn itself, the pid probe) injected — so this suite never spawns a real detached process, never
 * shells `lane-pool.mjs`, and never depends on a real delivery-report sidecar on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyClaimLiveness, decideOrphanAction, findLatestInFlightBuildRow, adoptOrphanedBuildClaims,
  checkResumable, spawnResumeDelivery, MAX_RESUME_ATTEMPTS,
} from '../build-dispatch-orphan-adopt.mjs';
import {
  acquireBuildDispatchClaim, listBuildDispatchClaims, releaseBuildDispatchClaim,
  markBuildDispatchResume, readBuildDispatchResume, releaseBuildDispatchResume,
} from '../build-dispatch-claim.mjs';

describe('classifyClaimLiveness — pure', () => {
  const row = (handle) => ({ runId: 'dispatch-lane-x', entry: { key: 'step:1:0', handle, payload: { lane: 3, sessionSlug: 's' } } });

  it('alive: the dispatch row\'s own pid answers alive, no resume marker', () => {
    const isPidAlive = (pid) => pid === 111;
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: null, isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('dead: the dispatch row\'s own pid is confirmed gone by the kernel', () => {
    const isPidAlive = () => false;
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: null, isPidAlive })).toMatchObject({ status: 'dead' });
  });

  it('no-record: no in-flight row and no resume marker — too early to judge', () => {
    expect(classifyClaimLiveness({ row: null, resumeMarker: null, isPidAlive: () => true })).toMatchObject({ status: 'no-record' });
  });

  // A marker BOUND to the row above (`dispatch-lane-x` / `step:1:0`) — the only shape that may answer for it.
  const bound = (meta) => ({ pid: 999, meta: { runId: 'dispatch-lane-x', rowKey: 'step:1:0', attempts: 1, ...meta } });

  it('a LIVE resume marker overrides the original (now-irrelevant) dispatch row\'s own dead pid', () => {
    const isPidAlive = (pid) => pid === 222; // only the RESUME's pid answers alive
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: bound({ pid: 222 }), isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('a DEAD resume marker (the resume attempt itself died) reports dead, not the original row\'s pid', () => {
    const isPidAlive = () => false;
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: bound({ pid: 222 }), isPidAlive })).toMatchObject({ status: 'dead' });
  });

  it('PR #2921 review — a STALE marker bound to an OLDER attempt never answers for a newer, live dispatch', () => {
    const isPidAlive = (pid) => pid === 111; // the NEW row's own wrapper is alive; the old resume pid is dead
    const stale = { pid: 999, meta: { pid: 222, runId: 'dispatch-lane-OLD', rowKey: 'step:1:0', attempts: 1 } };
    const r = classifyClaimLiveness({ row: row('pid:111'), resumeMarker: stale, isPidAlive });
    expect(r).toMatchObject({ status: 'alive', marker: null });
  });

  it('PR #2921 review — a marker carrying no row binding at all is ignored, never trusted', () => {
    const isPidAlive = (pid) => pid === 111;
    const unbound = { pid: 222, meta: { pid: 222 } };
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: unbound, isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('PR #2921 review — a PENDING marker (written before the spawn, no pid yet) reads alive inside the spawn '
    + 'grace, dead after it', () => {
    const isPidAlive = () => false;
    const t0 = Date.parse('2026-09-29T12:00:00Z');
    const pending = bound({ pid: null, resumedAt: new Date(t0).toISOString() });
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: pending, isPidAlive, nowMs: t0 + 1000 }).status).toBe('alive');
    // Past the grace it is UNCONFIRMED (the daemon may have died after spawning) — left alone, never 'dead'.
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: pending, isPidAlive, nowMs: t0 + 60 * 60_000 }).status).toBe('unconfirmed');
  });

  it('PR #2921 review — a marker recorded `spawnFailed` reads dead at once (known not running)', () => {
    const failed = bound({ pid: null, spawnFailed: true, resumedAt: new Date().toISOString() });
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: failed, isPidAlive: () => false }).status).toBe('dead');
  });
});

describe('decideOrphanAction — pure', () => {
  it('resumable → resume', () => {
    expect(decideOrphanAction({ resumable: true }).action).toBe('resume');
  });
  it('not resumable → release', () => {
    expect(decideOrphanAction({ resumable: false }).action).toBe('release');
  });
  it('PR #2921 review — resumable but the resume cap is spent → exhausted (release + hold), never a respawn', () => {
    expect(decideOrphanAction({ resumable: true, attempts: MAX_RESUME_ATTEMPTS }).action).toBe('exhausted');
    expect(decideOrphanAction({ resumable: true, attempts: MAX_RESUME_ATTEMPTS - 1 }).action).toBe('resume');
  });
  it('PR #2921 review — resumable while the kill switch / freeze is on → leave, never a spawn', () => {
    expect(decideOrphanAction({ resumable: true, allowResume: false }).action).toBe('leave');
  });
});

describe('checkResumable — PR #2921 review: the lane\'s commits must belong to THIS item', () => {
  const base = {
    lane: 9, sessionSlug: 'conveyor-4131', num: '4131', rowStartedAt: '2026-09-29T10:00:00Z',
    resolveLane: () => '/fake/lane-9', resolveReportsDir: () => '/fake/reports',
    isLaneCommitAhead: () => true,
  };
  const report = (over = {}) => ({
    item: '4131', status: 'done', filesTouched: ['scripts/a.mjs'], updatedAt: '2026-09-29T10:30:00Z', ...over,
  });

  it('resumable when the report is this item\'s, this attempt\'s, and covers every file the lane changed', () => {
    const r = checkResumable({ ...base, readReport: () => report(), listLaneChangedFiles: () => ['scripts/a.mjs'] });
    expect(r).toMatchObject({ resumable: true });
  });

  it('NOT resumable when the lane carries a commit touching a file the report never claimed (a reused lane)', () => {
    const r = checkResumable({ ...base, readReport: () => report(), listLaneChangedFiles: () => ['scripts/a.mjs', 'other-item.mjs'] });
    expect(r).toMatchObject({ resumable: false, reason: 'lane-commits-not-this-item' });
  });

  it('NOT resumable when the report names a different item', () => {
    const r = checkResumable({ ...base, readReport: () => report({ item: '9999' }), listLaneChangedFiles: () => ['scripts/a.mjs'] });
    expect(r).toMatchObject({ resumable: false, reason: 'report-item-mismatch' });
  });

  it('NOT resumable when the done report predates this dispatch (an older attempt\'s leftover)', () => {
    const r = checkResumable({ ...base, readReport: () => report({ updatedAt: '2026-09-29T09:00:00Z' }), listLaneChangedFiles: () => ['scripts/a.mjs'] });
    expect(r).toMatchObject({ resumable: false, reason: 'report-predates-dispatch' });
  });

  it('the item\'s OWN backlog card (edited by the wrapper\'s claim, not the agent) is never read as foreign', () => {
    const r = checkResumable({ ...base, readReport: () => report(), listLaneChangedFiles: () => ['scripts/a.mjs', 'backlog/4131-some-thing.md'] });
    expect(r).toMatchObject({ resumable: true });
    const other = checkResumable({ ...base, readReport: () => report(), listLaneChangedFiles: () => ['scripts/a.mjs', 'backlog/9999-other.md'] });
    expect(other).toMatchObject({ resumable: false, reason: 'lane-commits-not-this-item' });
  });

  it('a `WE:`-prefixed filesTouched entry still matches its plain path', () => {
    const r = checkResumable({ ...base, readReport: () => report({ filesTouched: ['WE:scripts/a.mjs'] }), listLaneChangedFiles: () => ['scripts/a.mjs'] });
    expect(r).toMatchObject({ resumable: true });
  });

  it('a non-`we` locus build is never resumable from the WE lane', () => {
    const r = checkResumable({ ...base, scope: 'plateau-app:src/x.ts', readReport: () => report(), listLaneChangedFiles: () => ['scripts/a.mjs'] });
    expect(r).toMatchObject({ resumable: false, reason: 'non-we-locus' });
  });

  it('NOT resumable when the lane diff cannot be read', () => {
    const r = checkResumable({ ...base, readReport: () => report(), listLaneChangedFiles: () => null });
    expect(r).toMatchObject({ resumable: false, reason: 'lane-diff-unreadable' });
  });
});

describe('spawnResumeDelivery — PR #2921 review: the resume settles the ORIGINAL run-store row', () => {
  it('passes --run-id and --effect-key through to the resumed wrapper', () => {
    let argv = null;
    spawnResumeDelivery(
      { num: '4131', lane: 9, scope: 'we:a', sessionSlug: 'conveyor-4131', runId: 'dispatch-lane-x', effectKey: 'step:1:0' },
      { spawnDetached: (a) => { argv = a; return { pid: 7 }; }, logPathFor: () => '/dev/null' },
    );
    expect(argv).toEqual(expect.arrayContaining(['--resume', '--run-id=dispatch-lane-x', '--effect-key=step:1:0']));
  });
});

describe('findLatestInFlightBuildRow — pure', () => {
  const buildEffect = (num, status, startedAt, handle) => ({
    type: 'conveyor.dispatch-delivery-agent', status, startedAt, handle,
    payload: { num, launchKind: 'build', lane: 3, sessionSlug: `conveyor-${num}` },
  });

  it('picks the newest IN-FLIGHT row for the item, ignoring other items and settled rows', () => {
    const runs = [
      { id: 'dispatch-lane-a', record: { effects: [buildEffect('4131', 'in-flight', '2026-09-29T10:46:00Z', 'pid:1')] } },
      { id: 'dispatch-lane-b', record: { effects: [buildEffect('4131', 'in-flight', '2026-09-29T11:00:00Z', 'pid:2')] } },
      { id: 'dispatch-lane-c', record: { effects: [buildEffect('4131', 'applied', '2026-09-29T12:00:00Z', 'pid:3')] } },
      { id: 'dispatch-lane-d', record: { effects: [buildEffect('9999', 'in-flight', '2026-09-29T13:00:00Z', 'pid:4')] } },
    ];
    const row = findLatestInFlightBuildRow(runs, '4131');
    expect(row).toMatchObject({ runId: 'dispatch-lane-b', entry: { handle: 'pid:2' } });
  });

  it('returns null when nothing in-flight matches', () => {
    expect(findLatestInFlightBuildRow([], '4131')).toBeNull();
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

  const buildRow = ({ num, handle, lane = 3, sessionSlug = `conveyor-${num}` }) => ({
    runId: 'dispatch-lane-x',
    entry: { key: 'step:1:0', handle, payload: { num, launchKind: 'build', lane, sessionSlug, scope: [] } },
  });

  it('LEAVES a claim whose recorded dispatch is still alive', async () => {
    acquireBuildDispatchClaim({ num: '4295', scope: [], lockRoot });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
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
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['4295']);
  });

  it('RESUMES a dead-wrapper claim whose report + lane commit are still there — the #4131 shape: claim stays '
    + 'held, a fresh detached resume is spawned, and a resume marker records its pid', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    let spawnedWith = null;
    let markedWith = null;
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
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
      markResume: (o) => { markedWith = [...(markedWith || []), o]; },
    });
    expect(results).toEqual([{ num: '4131', action: 'resume', reason: expect.stringContaining('resumable'), pid: 55555 }]);
    expect(spawnedWith).toMatchObject({
      num: '4131', lane: 9, sessionSlug: 'conveyor-4131', runId: 'dispatch-lane-x', effectKey: 'step:1:0',
    });
    // PR #2921 review — PENDING marker first (before the spawn), then the real pid; both bound to the row.
    const binding = { runId: 'dispatch-lane-x', rowKey: 'step:1:0', attempts: 1 };
    expect(markedWith).toEqual([{ num: '4131', pid: null, ...binding }, { num: '4131', pid: 55555, ...binding }]);
    // THE POINT: the claim is STILL held — never released while a resume is legitimately in flight.
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['4131']);
  });

  it('RELEASES a dead-wrapper claim with nothing resumable — the #4382 shape: claim freed, NO hold, stale '
    + 'run-store row settled', async () => {
    acquireBuildDispatchClaim({ num: '4382', scope: [], lockRoot });
    let settledWith = null;
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
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
    expect(settledWith).toMatchObject({ runId: 'dispatch-lane-x', key: 'step:1:0', outcome: 'orphan-released' });
    // THE POINT: the claim is GONE — the very next tick can offer #4382 for a completely fresh dispatch.
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('LEAVES alone once a resume is already under way (a live resume marker) — never double-resumes', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    markBuildDispatchResume({ num: '4131', pid: 55555, runId: 'dispatch-lane-x', rowKey: 'step:1:0', lockRoot: resumeRoot });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
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

  // ── PR #2921 review findings ────────────────────────────────────────────────────────────────────────────

  it('a STALE resume marker from an older attempt never gets a NEWER live build released — the claim stays, '
    + 'and the stale marker is cleared', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    // The OLD resume (bound to an older row) is dead; the fresh re-dispatch's own wrapper (pid 777) is alive.
    markBuildDispatchResume({ num: '4131', pid: 55555, runId: 'dispatch-lane-OLD', rowKey: 'step:1:0', lockRoot: resumeRoot });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: (pid) => pid === 777,
      findRow: () => buildRow({ num: '4131', handle: 'pid:777' }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => ({ resumable: false, reason: 'no-done-report' }),
      releaseClaim: () => { throw new Error('must not release a LIVE build'); },
      releaseResumeMarker: ({ num }) => releaseBuildDispatchResume({ num, lockRoot: resumeRoot }),
      settleRow: () => { throw new Error('must not settle a LIVE build\'s row'); },
      spawnResume: () => { throw new Error('must not spawn'); },
      markResume: () => { throw new Error('must not mark'); },
    });
    expect(results).toEqual([{ num: '4131', action: 'leave', reason: 'alive' }]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['4131']);
    expect(readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot })).toBeNull();
  });

  it('respawning is BOUNDED: a resume that keeps dying is resumed at most MAX_RESUME_ATTEMPTS times, then the '
    + 'claim is released with a HOLD and the row settled — never an endless respawn', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    const spawned = [];
    const holds = [];
    const settled = [];
    const pass = () => adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false, // every resume dies immediately
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142', lane: 9 }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => ({ resumable: true, lanePath: '/fake/lane-9' }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      releaseResumeMarker: ({ num }) => releaseBuildDispatchResume({ num, lockRoot: resumeRoot }),
      settleRow: (o) => { settled.push(o); },
      placeHold: (o) => { holds.push(o); },
      spawnResume: () => { spawned.push(1); return 60000 + spawned.length; },
      markResume: (o) => markBuildDispatchResume({ ...o, lockRoot: resumeRoot }),
    });
    const actions = [];
    for (let i = 0; i < MAX_RESUME_ATTEMPTS + 3; i += 1) {
      const r = await pass();
      actions.push(r[0]?.action ?? 'none');
    }
    expect(spawned.length).toBe(MAX_RESUME_ATTEMPTS);
    expect(actions.slice(0, MAX_RESUME_ATTEMPTS + 1)).toEqual([...Array(MAX_RESUME_ATTEMPTS).fill('resume'), 'exhausted']);
    expect(holds).toEqual([expect.objectContaining({ num: '4131', reason: expect.stringContaining('resume') })]);
    expect(settled).toEqual([expect.objectContaining({ runId: 'dispatch-lane-x', outcome: 'orphan-resume-exhausted' })]);
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
    expect(readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot })).toBeNull();
  });

  it('the marker is written BEFORE the spawn: a crash right after spawning still leaves a marker, so the next '
    + 'pass does not spawn a second resume', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    let spawns = 0;
    let markCalls = 0;
    const opts = (markResume) => ({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => ({ resumable: true }),
      releaseClaim: () => { throw new Error('must not release'); },
      releaseResumeMarker: () => {},
      settleRow: () => {},
      spawnResume: () => { spawns += 1; return 55555; },
      markResume,
    });
    // pass 1: the pending mark lands, the spawn happens, then the post-spawn mark THROWS (fs error / crash).
    const r1 = await adoptOrphanedBuildClaims(opts((o) => {
      markCalls += 1;
      if (markCalls === 2) throw new Error('disk full');
      return markBuildDispatchResume({ ...o, lockRoot: resumeRoot });
    }));
    expect(spawns).toBe(1);
    expect(r1).toEqual([expect.objectContaining({ num: '4131', action: 'error', reason: expect.stringContaining('disk full') })]);
    // pass 2, moments later: the PENDING marker is inside its spawn grace — no second resume.
    const r2 = await adoptOrphanedBuildClaims(opts((o) => markBuildDispatchResume({ ...o, lockRoot: resumeRoot })));
    expect(spawns).toBe(1);
    expect(r2).toEqual([{ num: '4131', action: 'leave', reason: 'alive' }]);
  });

  it('a spawn that THROWS is recorded spawnFailed: reported as an error, and the next pass counts that attempt '
    + 'and retries — never waiting out a TTL for a resume known not to be running', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    let spawns = 0;
    const opts = (spawnResume) => ({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => ({ resumable: true }),
      releaseClaim: () => { throw new Error('must not release'); },
      releaseResumeMarker: () => {},
      settleRow: () => {},
      spawnResume,
      markResume: (o) => markBuildDispatchResume({ ...o, lockRoot: resumeRoot }),
    });
    const r1 = await adoptOrphanedBuildClaims(opts(() => { spawns += 1; throw new Error('EAGAIN'); }));
    expect(r1).toEqual([expect.objectContaining({ action: 'error', reason: 'EAGAIN' })]);
    expect(readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }).meta).toMatchObject({ spawnFailed: true, attempts: 1 });
    const r2 = await adoptOrphanedBuildClaims(opts(() => { spawns += 1; return 777; }));
    expect(r2).toEqual([expect.objectContaining({ action: 'resume', pid: 777 })]);
    expect(readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }).meta).toMatchObject({ pid: 777, attempts: 2, spawnFailed: false });
    expect(spawns).toBe(2);
  });

  it('the exhausted branch places the hold BEFORE releasing the claim', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    markBuildDispatchResume({ num: '4131', pid: 1, runId: 'dispatch-lane-x', rowKey: 'step:1:0', attempts: MAX_RESUME_ATTEMPTS, lockRoot: resumeRoot });
    const order = [];
    await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot }),
      resolveResumability: () => ({ resumable: true }),
      releaseClaim: () => order.push('release'),
      releaseResumeMarker: () => {},
      settleRow: () => order.push('settle'),
      placeHold: () => order.push('hold'),
    });
    expect(order).toEqual(['hold', 'release', 'settle']);
  });

  it('one throwing claim never aborts adoption of the claims after it', async () => {
    acquireBuildDispatchClaim({ num: '1', scope: [], lockRoot });
    acquireBuildDispatchClaim({ num: '2', scope: [], lockRoot });
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false,
      findRow: (num) => { if (num === '1') throw new Error('boom'); return buildRow({ num, handle: 'pid:5' }); },
      readResumeMarker: () => null,
      resolveResumability: () => ({ resumable: false, reason: 'no-done-report' }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      releaseResumeMarker: () => {},
      settleRow: () => {},
    });
    const byNum = Object.fromEntries(results.map((r) => [r.num, r.action]));
    expect(byNum).toEqual({ 1: 'error', 2: 'release' });
  });

  it('allowResume:false (kill switch / freeze) never spawns a resume — the claim is left for a later tick', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    const results = await adoptOrphanedBuildClaims({
      allowResume: false,
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => false,
      findRow: () => buildRow({ num: '4131', handle: 'pid:74142' }),
      readResumeMarker: () => null,
      resolveResumability: () => ({ resumable: true }),
      releaseClaim: () => { throw new Error('must not release a resumable orphan'); },
      releaseResumeMarker: () => {},
      settleRow: () => { throw new Error('must not settle'); },
      spawnResume: () => { throw new Error('must not spawn while frozen'); },
      markResume: () => { throw new Error('must not mark while frozen'); },
    });
    expect(results).toEqual([{ num: '4131', action: 'leave', reason: expect.stringContaining('frozen') }]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['4131']);
  });

  it('reads the run store ONCE per pass, however many claims there are', async () => {
    for (const n of ['1', '2', '3']) acquireBuildDispatchClaim({ num: n, scope: [], lockRoot });
    let listRunsCalls = 0;
    await adoptOrphanedBuildClaims({
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      isPidAlive: () => true,
      listRuns: () => { listRunsCalls += 1; return []; },
      readResumeMarker: () => null,
    });
    expect(listRunsCalls).toBe(1);
  });

  it('ignores a non-`build`-kind claim entirely (never reached, but defensive)', async () => {
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => [{ owner: 'x', meta: { num: '1', kind: 'not-build' } }],
      isPidAlive: () => { throw new Error('must never be consulted for a non-build claim'); },
    });
    expect(results).toEqual([]);
  });
});
