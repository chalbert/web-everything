/**
 * @file scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs
 * @description we:backlog/x5uqim1-*.md (#4075/#3383) — the IO shell over `main-red-recovery.mjs`'s pure planner.
 *   Fixtures are the REAL shapes measured 2026-09-25 off `chalbert/web-everything`: PR #2635 (never yet rerun,
 *   inside main's real red window) is the one this pass should actually rerun; PR #2596 (already `attempt: 2`
 *   from the operator's own manual rerun, still red) is the one it must report ALREADY HANDLED.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildCandidates, sweepCiRedRecovery, rerunFailedJobs, formatReport } from '../ci-red-recovery-watch.mjs';

const failingCheck = (completedAt, runId) => ({
  __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', completedAt,
  detailsUrl: `https://github.com/chalbert/web-everything/actions/runs/${runId}/job/1`,
});
const greenCheck = { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-09-25T01:00:00Z' };

const PR_2635 = { number: 2635, headRefName: 'lane/xdzl6mb', statusCheckRollup: [failingCheck('2026-09-25T01:57:47Z', 36083748258)] };
const PR_2596 = { number: 2596, headRefName: 'lane/batch-...-3901', statusCheckRollup: [failingCheck('2026-09-25T02:02:29Z', 36084065168)] };
const PR_2636 = { number: 2636, headRefName: 'lane/batch-...-3915', statusCheckRollup: [failingCheck('2026-09-25T08:03:45Z', 36084655276)] };
const PR_QUIET = { number: 1, headRefName: 'lane/quiet', statusCheckRollup: [greenCheck] };

const MAIN_RUNS = [
  { status: 'completed', conclusion: 'failure', updatedAt: '2026-09-25T01:30:55Z', workflowName: 'CI' },
  { status: 'completed', conclusion: 'success', updatedAt: '2026-09-25T02:31:25Z', workflowName: 'CI' },
];

describe('ci-red-recovery-watch — buildCandidates', () => {
  it('only builds a candidate for a PR whose required check is currently failing, resolving its run id', () => {
    const readRunAttempt = vi.fn(() => 1);
    const candidates = buildCandidates([PR_QUIET, PR_2635], { readRunAttempt });
    expect(candidates).toEqual([
      { prNumber: 2635, headRefName: 'lane/xdzl6mb', runId: 36083748258, attempt: 1, failureCompletedAt: '2026-09-25T01:57:47Z' },
    ]);
    expect(readRunAttempt).toHaveBeenCalledTimes(1);
    expect(readRunAttempt).toHaveBeenCalledWith(36083748258, { repo: null });
  });

  it('never calls readRunAttempt for a PR with nothing failing', () => {
    const readRunAttempt = vi.fn();
    buildCandidates([PR_QUIET], { readRunAttempt });
    expect(readRunAttempt).not.toHaveBeenCalled();
  });
});

describe('ci-red-recovery-watch — sweepCiRedRecovery (dry run, apply: false by default)', () => {
  it('plans a real ci-rerun for PR #2635 (never yet rerun, inside the real red window) and never calls rerun without --apply', () => {
    const readOpenPrs = () => [PR_2635, PR_QUIET];
    const readMainRuns = vi.fn(() => MAIN_RUNS);
    const readRunAttempt = () => 1;
    const rerun = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readRunAttempt, rerun });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2635, kind: 'ci-rerun', runId: 36083748258 })]);
    expect(result.applied).toEqual([]);
    expect(rerun).not.toHaveBeenCalled();
  });

  it('applies exactly one gh run rerun --failed per dispatched candidate when apply: true', () => {
    const readOpenPrs = () => [PR_2635];
    const readMainRuns = () => MAIN_RUNS;
    const readRunAttempt = () => 1;
    const rerun = vi.fn(() => ({ ok: true }));
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readRunAttempt, rerun, apply: true });
    expect(rerun).toHaveBeenCalledTimes(1);
    expect(rerun).toHaveBeenCalledWith(36083748258, { repo: null });
    expect(result.applied).toEqual([{ prNumber: 2635, runId: 36083748258, ok: true }]);
  });

  it('PR #2596 (operator already reran once, attempt 2, still red) is reported already-rerun, not re-applied', () => {
    const readOpenPrs = () => [PR_2596];
    const readMainRuns = () => MAIN_RUNS;
    const readRunAttempt = () => 2; // GitHub's own attempt count, post operator-rerun
    const rerun = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readRunAttempt, rerun, apply: true });
    expect(result.dispatch).toEqual([]);
    expect(result.refusals).toEqual([expect.objectContaining({ prNumber: 2596, kind: 'already-rerun' })]);
    expect(rerun).not.toHaveBeenCalled();
  });

  it('PR #2636 (failed hours after main recovered — its own failure) is refused own-failure, never rerun', () => {
    const readOpenPrs = () => [PR_2636];
    const readMainRuns = () => MAIN_RUNS;
    const readRunAttempt = () => 1;
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readRunAttempt, rerun: vi.fn() });
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
    const readRunAttempt = (runId) => (runId === 36083748258 ? 1 : 2);
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readRunAttempt, rerun: vi.fn() });
    expect(result.dispatch.map((d) => d.prNumber)).toEqual([2635]);
    expect(result.refusals.map((r) => ({ pr: r.prNumber, kind: r.kind }))).toEqual([
      { pr: 2596, kind: 'already-rerun' },
      { pr: 2636, kind: 'own-failure' },
    ]);
  });
});

describe('ci-red-recovery-watch — rerunFailedJobs', () => {
  it('runs the exact gh run rerun --failed argv, and degrades to {ok:false} rather than throwing', () => {
    const exec = vi.fn();
    expect(rerunFailedJobs(123, { exec })).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledWith('gh', ['run', 'rerun', '123', '--failed'], expect.any(Object));

    const throwing = vi.fn(() => { throw new Error('gh: run not found'); });
    expect(rerunFailedJobs(999, { exec: throwing })).toEqual({ ok: false, error: 'gh: run not found' });
  });
});

describe('ci-red-recovery-watch — formatReport', () => {
  it('prints one line per dispatch/refusal/applied — silence is the defect this pass exists to avoid', () => {
    const report = formatReport({
      dispatch: [{ prNumber: 2635, runId: 1, why: 'x' }],
      refusals: [{ prNumber: 2596, kind: 'already-rerun', why: 'y' }],
      applied: [{ prNumber: 2635, runId: 1, ok: true }],
    });
    expect(report).toContain('PR #2635 run 1');
    expect(report).toContain('already-rerun PR #2596');
    expect(report).toContain('applied: gh run rerun 1 --failed (PR #2635)');
  });
});
