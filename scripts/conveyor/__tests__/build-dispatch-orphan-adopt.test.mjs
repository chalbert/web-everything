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
} from '../build-dispatch-orphan-adopt.mjs';
import {
  acquireBuildDispatchClaim, listBuildDispatchClaims, releaseBuildDispatchClaim,
  markBuildDispatchResume, readBuildDispatchResume,
} from '../build-dispatch-claim.mjs';

describe('classifyClaimLiveness — pure', () => {
  const row = (handle) => ({ runId: 'dispatch-lane-x', entry: { handle, payload: { lane: 3, sessionSlug: 's' } } });

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

  it('a LIVE resume marker overrides the original (now-irrelevant) dispatch row\'s own dead pid', () => {
    const isPidAlive = (pid) => pid === 222; // only the RESUME's pid answers alive
    const marker = { pid: 222, meta: { pid: 222 } };
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: marker, isPidAlive })).toMatchObject({ status: 'alive' });
  });

  it('a DEAD resume marker (the resume attempt itself died) reports dead, not the original row\'s pid', () => {
    const isPidAlive = () => false;
    const marker = { pid: 222, meta: { pid: 222 } };
    expect(classifyClaimLiveness({ row: row('pid:111'), resumeMarker: marker, isPidAlive })).toMatchObject({ status: 'dead' });
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
      markResume: (o) => { markedWith = o; },
    });
    expect(results).toEqual([{ num: '4131', action: 'resume', reason: expect.stringContaining('resumable'), pid: 55555 }]);
    expect(spawnedWith).toMatchObject({ num: '4131', lane: 9, sessionSlug: 'conveyor-4131' });
    expect(markedWith).toEqual({ num: '4131', pid: 55555 });
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
    expect(settledWith).toEqual({ runId: 'dispatch-lane-x', key: 'step:1:0' });
    // THE POINT: the claim is GONE — the very next tick can offer #4382 for a completely fresh dispatch.
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('LEAVES alone once a resume is already under way (a live resume marker) — never double-resumes', async () => {
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot });
    markBuildDispatchResume({ num: '4131', pid: 55555, lockRoot: resumeRoot });
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

  it('ignores a non-`build`-kind claim entirely (never reached, but defensive)', async () => {
    const results = await adoptOrphanedBuildClaims({
      listClaims: () => [{ owner: 'x', meta: { num: '1', kind: 'not-build' } }],
      isPidAlive: () => { throw new Error('must never be consulted for a non-build claim'); },
    });
    expect(results).toEqual([]);
  });
});
