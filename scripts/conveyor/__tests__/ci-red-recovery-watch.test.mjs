/**
 * @file scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs
 * @description we:backlog/x5uqim1-*.md (#4075/#3383) — the IO shell over `main-red-recovery.mjs`'s pure planner.
 *   Fixtures are the REAL shapes measured 2026-09-25 off `chalbert/web-everything`: PR #2635 (33 commits behind
 *   main, never refreshed, inside main's real red window) is the one this pass should actually refresh; PR
 *   #2596 (`ahead_by: 0` from the operator's own manual branch refresh, still red) is the one it must report
 *   ALREADY HANDLED. CORRECTED mid-build from an earlier `gh run rerun` design — see `main-red-recovery.mjs`'s
 *   own file header for why a rebase onto `main`, not a rerun of the same stale commit, is the real mechanism.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildCandidates, sweepCiRedRecovery, refreshOntoMain, formatReport } from '../ci-red-recovery-watch.mjs';

const failingCheck = (completedAt) => ({ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', completedAt });
const greenCheck = { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-09-25T01:00:00Z' };

const PR_2635 = { number: 2635, headRefName: 'lane/xdzl6mb', headRefOid: 'ab9985630d90019a07b94e946bc75f8de7a6161f', statusCheckRollup: [failingCheck('2026-09-25T01:57:47Z')] };
const PR_2596 = { number: 2596, headRefName: 'lane/batch-...-3901', headRefOid: 'b5275541aebe374f5d9e96af3943bb4c282227aa', statusCheckRollup: [failingCheck('2026-09-25T02:02:29Z')] };
const PR_2636 = { number: 2636, headRefName: 'lane/batch-...-3915', headRefOid: 'deadbeef', statusCheckRollup: [failingCheck('2026-09-25T08:03:45Z')] };
const PR_QUIET = { number: 1, headRefName: 'lane/quiet', headRefOid: 'cafe', statusCheckRollup: [greenCheck] };

const MAIN_RUNS = [
  { status: 'completed', conclusion: 'failure', updatedAt: '2026-09-25T01:30:55Z', workflowName: 'CI' },
  { status: 'completed', conclusion: 'success', updatedAt: '2026-09-25T02:31:25Z', workflowName: 'CI' },
];

describe('ci-red-recovery-watch — buildCandidates', () => {
  it('only builds a candidate for a PR whose required check is currently failing, resolving how far behind main it is', () => {
    const readAheadBy = vi.fn(() => 33);
    const candidates = buildCandidates([PR_QUIET, PR_2635], { readAheadBy });
    expect(candidates).toEqual([
      { prNumber: 2635, headRefName: 'lane/xdzl6mb', aheadBy: 33, failureCompletedAt: '2026-09-25T01:57:47Z' },
    ]);
    expect(readAheadBy).toHaveBeenCalledTimes(1);
    expect(readAheadBy).toHaveBeenCalledWith('ab9985630d90019a07b94e946bc75f8de7a6161f', { repo: null, base: 'main' });
  });

  it('never calls readAheadBy for a PR with nothing failing', () => {
    const readAheadBy = vi.fn();
    buildCandidates([PR_QUIET], { readAheadBy });
    expect(readAheadBy).not.toHaveBeenCalled();
  });
});

describe('ci-red-recovery-watch — sweepCiRedRecovery (dry run, apply: false by default)', () => {
  it('plans a real rebase-onto-main for PR #2635 (never yet refreshed, inside the real red window) and never touches git without --apply', () => {
    const readOpenPrs = () => [PR_2635, PR_QUIET];
    const readMainRuns = vi.fn(() => MAIN_RUNS);
    const readAheadBy = () => 33;
    const refresh = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, refresh });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2635, kind: 'rebase-onto-main', aheadBy: 33 })]);
    expect(result.applied).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('applies exactly one refresh per dispatched candidate when apply: true', () => {
    const readOpenPrs = () => [PR_2635];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 33;
    const refresh = vi.fn(() => ({ ok: true, action: 'rebased' }));
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, refresh, apply: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('lane/xdzl6mb', { base: 'origin/main' });
    expect(result.applied).toEqual([{ prNumber: 2635, headRefName: 'lane/xdzl6mb', ok: true, action: 'rebased' }]);
  });

  it('PR #2596 (operator already refreshed it by hand, ahead_by 0, still red) is reported already-current, never re-applied', () => {
    const readOpenPrs = () => [PR_2596];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 0; // GitHub's own compare result, post operator-refresh
    const refresh = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, refresh, apply: true });
    expect(result.dispatch).toEqual([]);
    expect(result.refusals).toEqual([expect.objectContaining({ prNumber: 2596, kind: 'already-current' })]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('PR #2636 (failed hours after main recovered — its own failure) is refused own-failure, never refreshed', () => {
    const readOpenPrs = () => [PR_2636];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 33;
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, refresh: vi.fn() });
    expect(result.refusals).toEqual([expect.objectContaining({ prNumber: 2636, kind: 'own-failure' })]);
  });

  it('never reads main\'s own run history at all when nothing is currently failing — the zero-cost path', () => {
    const readMainRuns = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs: () => [PR_QUIET], readMainRuns });
    expect(readMainRuns).not.toHaveBeenCalled();
    expect(result.dispatch).toEqual([]);
    expect(result.refusals).toEqual([]);
  });

  it('a mid-sweep read of ALL current candidates at once yields the exact live before/after: #2635 owed, #2596/#2636 handled', () => {
    // The live 2026-09-25 snapshot this item was built against, in one sweep.
    const readOpenPrs = () => [PR_2635, PR_2596, PR_2636];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = (headSha) => (headSha === PR_2635.headRefOid ? 33 : 0);
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, refresh: vi.fn() });
    expect(result.dispatch.map((d) => d.prNumber)).toEqual([2635]);
    expect(result.refusals.map((r) => ({ pr: r.prNumber, kind: r.kind }))).toEqual([
      { pr: 2596, kind: 'already-current' },
      { pr: 2636, kind: 'own-failure' },
    ]);
  });
});

describe('ci-red-recovery-watch — refreshOntoMain', () => {
  it('delegates to rebaseDropManifest and reports its action verbatim on success', () => {
    const rebase = vi.fn(() => ({ action: 'rebased', newCommit: 'abc123' }));
    expect(refreshOntoMain('lane/xdzl6mb', { root: '/repo', base: 'origin/main', rebase })).toEqual({ ok: true, action: 'rebased' });
    expect(rebase).toHaveBeenCalledWith({ laneRef: 'lane/xdzl6mb', base: 'origin/main', cwd: '/repo' });
  });

  it('reports action:"current" as ok — rebaseDropManifest\'s own idempotency short-circuit, not a failure', () => {
    const rebase = vi.fn(() => ({ action: 'current', newCommit: 'abc123' }));
    expect(refreshOntoMain('lane/x', { rebase })).toEqual({ ok: true, action: 'current' });
  });

  it('surfaces a real conflict (action:"skip") and a hard failure (action:"error") as not-ok, never force-resolved', () => {
    expect(refreshOntoMain('lane/x', { rebase: () => ({ action: 'skip', reason: 'real conflict beyond .lane-manifest.json' }) }))
      .toEqual({ ok: false, action: 'skip', error: 'real conflict beyond .lane-manifest.json' });
    expect(refreshOntoMain('lane/x', { rebase: () => ({ action: 'error', reason: 'push failed' }) }))
      .toEqual({ ok: false, action: 'error', error: 'push failed' });
  });
});

describe('ci-red-recovery-watch — formatReport', () => {
  it('prints one line per dispatch/refusal/applied — silence is the defect this pass exists to avoid', () => {
    const report = formatReport({
      dispatch: [{ prNumber: 2635, headRefName: 'lane/xdzl6mb', why: 'x' }],
      refusals: [{ prNumber: 2596, kind: 'already-current', why: 'y' }],
      applied: [{ prNumber: 2635, headRefName: 'lane/xdzl6mb', ok: true, action: 'rebased' }],
    });
    expect(report).toContain('rebase-onto-main PR #2635 (lane/xdzl6mb)');
    expect(report).toContain('already-current PR #2596');
    expect(report).toContain('applied: rebased lane/xdzl6mb onto main (PR #2635)');
  });
});
