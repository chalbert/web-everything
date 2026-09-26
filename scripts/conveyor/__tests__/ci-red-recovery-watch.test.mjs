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
import { homedir } from 'node:os';
import { REPO_ROOT } from '../../operations/dispatch-lane-io.mjs';
import {
  buildCandidates, sweepCiRedRecovery, refreshOntoMain, formatReport,
  HUNG_CI_COMMENT_MARKER, buildHungCiComment, countHungCiComments, countHungCiCommentsByJob, bodyHasExactLine,
  cancelAndRerunHungRun, cancelHungRun, describeExecError, redactTokenShapes, sweepHungCiRecovery, formatHungReport,
  defaultReadRequiredContexts, defaultReadHeadCommittedAt, triggerCiForPr, clearStaleCheckingLabel,
  sweepMissingRunRecovery, formatMissingRunReport,
} from '../ci-red-recovery-watch.mjs';

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
      {
        prNumber: 2635, headRefName: 'lane/xdzl6mb', headSha: 'ab9985630d90019a07b94e946bc75f8de7a6161f',
        aheadBy: 33, failureCompletedAt: '2026-09-25T01:57:47Z',
      },
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
    const readComments = () => [];
    const refresh = vi.fn();
    const result = sweepCiRedRecovery({ readOpenPrs, readMainRuns, readAheadBy, readComments, refresh });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2635, kind: 'rebase-onto-main', aheadBy: 33 })]);
    expect(result.applied).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('applies exactly one refresh per dispatched candidate when apply: true, and posts the durable rebase marker', () => {
    const readOpenPrs = () => [PR_2635];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 33;
    const readComments = vi.fn(() => []); // no prior rebase-onto-main attempts on this sha — under cap
    const refresh = vi.fn(() => ({ ok: true, action: 'rebased' }));
    const postComment = vi.fn();
    const result = sweepCiRedRecovery({
      readOpenPrs, readMainRuns, readAheadBy, readComments, refresh, postComment, apply: true,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    // `root` defaults to WE's own checkout (no `repo` given) — see this pass's own multi-repo docblock.
    expect(refresh).toHaveBeenCalledWith('lane/xdzl6mb', expect.objectContaining({ base: 'origin/main' }));
    expect(result.applied).toEqual([{ prNumber: 2635, headRefName: 'lane/xdzl6mb', ok: true, action: 'rebased' }]);
    expect(postComment).toHaveBeenCalledWith(2635, expect.objectContaining({
      headRefName: 'lane/xdzl6mb', ok: true, action: 'rebased',
    }));
  });

  // x5uqim1 follow-up (#4075/#3383) part (c) — "check the owed-ci-rerun path for frontierui/plateau-app too":
  // `rebaseDropManifest` needs a REAL LOCAL checkout of the repo being rebased. Left at WE's own `REPO_ROOT`
  // unconditionally, this would have run every mechanical rebase in the WRONG local git repo for those two.
  it('resolves the frontierui sibling checkout as `root` when repo is frontierui, never WE\'s own REPO_ROOT', () => {
    const readOpenPrs = () => [PR_2635];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 33;
    const readComments = () => [];
    const refresh = vi.fn(() => ({ ok: true, action: 'rebased' }));
    sweepCiRedRecovery({
      repo: 'chalbert/frontierui', readOpenPrs, readMainRuns, readAheadBy, readComments, refresh,
      postComment: vi.fn(), apply: true,
    });
    expect(refresh).toHaveBeenCalledWith('lane/xdzl6mb', expect.objectContaining({
      root: `${homedir()}/workspace/frontierui`,
    }));
  });

  it('defaults `root` to REPO_ROOT (WE\'s own checkout) when no repo is given', () => {
    const readOpenPrs = () => [PR_2635];
    const readMainRuns = () => MAIN_RUNS;
    const readAheadBy = () => 33;
    const readComments = () => [];
    const refresh = vi.fn(() => ({ ok: true, action: 'rebased' }));
    sweepCiRedRecovery({
      readOpenPrs, readMainRuns, readAheadBy, readComments, refresh, postComment: vi.fn(), apply: true,
    });
    expect(refresh).toHaveBeenCalledWith('lane/xdzl6mb', expect.objectContaining({ root: REPO_ROOT }));
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
    const readComments = () => []; // #2635 is the only candidate that ever reaches this read (aheadBy > 0, main-red)
    const result = sweepCiRedRecovery({
      readOpenPrs, readMainRuns, readAheadBy, readComments, refresh: vi.fn(),
    });
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

// ── HUNG-CI-RUN RECOVERY (xd1sfms, #4075/#3383) ─────────────────────────────────────────────────────────────
// Same #2636/run-36161558017 real shape as `main-red-recovery.test.mjs`'s own hung-run fixtures — this half
// proves the IO shell: durable per-sha marker counting, the cancel-then-rerun write, and the sweep's own
// "pay for the comments read only when actually hung" discipline.
const runningCheck = (name, startedAt, detailsUrl) => ({
  __typename: 'CheckRun', name, workflowName: 'CI', status: 'IN_PROGRESS', conclusion: '', startedAt, detailsUrl,
});
const RUN_URL = (job) => `https://github.com/chalbert/web-everything/actions/runs/36161558017/job/${job}`;
const PR_2636_HUNG = {
  number: 2636, headRefName: 'lane/batch-...-3915', headRefOid: 'deadbeef2636',
  statusCheckRollup: [runningCheck('test-shard (1)', '2026-09-25T16:34:28Z', RUN_URL('108159093983'))],
};
const NOW = Date.parse('2026-09-25T20:10:00Z');

describe('ci-red-recovery-watch — buildHungCiComment / countHungCiComments', () => {
  it('the built comment starts with the marker and embeds the exact head sha', () => {
    const body = buildHungCiComment({ runId: 36161558017, headSha: 'deadbeef2636' });
    expect(body.startsWith(HUNG_CI_COMMENT_MARKER)).toBe(true);
    expect(body).toContain('sha: deadbeef2636');
    expect(body).toContain('36161558017');
  });

  it('counts only a trusted marker comment naming THIS head sha', () => {
    const comments = [
      { body: buildHungCiComment({ headSha: 'deadbeef2636' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'deadbeef2636' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'a-different-sha' }), author: { login: 'web-everything' } }, // a stale attempt against an OLD sha — must not count
      { body: buildHungCiComment({ headSha: 'deadbeef2636' }), author: { login: 'some-random-user' } }, // untrusted author — a forged marker
      { body: 'unrelated comment' },
    ];
    expect(countHungCiComments(comments, 'deadbeef2636')).toBe(2);
  });

  it('a non-array/empty input counts zero', () => {
    expect(countHungCiComments(null)).toBe(0);
    expect(countHungCiComments([])).toBe(0);
  });
});

describe('ci-red-recovery-watch — cancelAndRerunHungRun', () => {
  it('cancels, sleeps once, then reruns the WHOLE run (never --failed against its own fresh cancel)', () => {
    const calls = [];
    const exec = vi.fn((file, args) => { calls.push(args); return ''; });
    const sleepSync = vi.fn();
    const result = cancelAndRerunHungRun(36161558017, { repo: 'chalbert/web-everything', exec, sleepSync });
    expect(result).toEqual({ ok: true, action: 'cancelled-and-rerun' });
    expect(calls[0]).toEqual(['run', 'cancel', '36161558017', '--repo', 'chalbert/web-everything']);
    expect(calls[1]).toEqual(['run', 'rerun', '36161558017', '--repo', 'chalbert/web-everything']);
    expect(calls[1]).not.toContain('--failed');
    expect(sleepSync).toHaveBeenCalledTimes(1);
  });

  it('reports a failed cancel without ever attempting the rerun', () => {
    const exec = vi.fn(() => { throw new Error('gh: run not found'); });
    const result = cancelAndRerunHungRun(1, { exec, sleepSync: vi.fn() });
    expect(result).toEqual({ ok: false, action: 'cancel-failed', error: 'gh: run not found' });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('reports a failed rerun distinctly from a failed cancel', () => {
    let n = 0;
    const exec = vi.fn(() => { n += 1; if (n === 2) throw new Error('gh: rerun rejected'); return ''; });
    const result = cancelAndRerunHungRun(1, { exec, sleepSync: vi.fn() });
    expect(result).toEqual({ ok: false, action: 'rerun-failed', error: 'gh: rerun rejected' });
  });
});

describe('ci-red-recovery-watch — sweepHungCiRecovery', () => {
  it("plans a real cancel+rerun for PR #2636's real shape, never touching gh without --apply", () => {
    const readOpenPrs = () => [PR_2636_HUNG];
    const readComments = vi.fn(() => []);
    const cancelAndRerun = vi.fn();
    const result = sweepHungCiRecovery({ readOpenPrs, readComments, cancelAndRerun, now: NOW });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2636, runId: 36161558017, kind: 'hung-cancel-rerun' })]);
    expect(result.applied).toEqual([]);
    expect(cancelAndRerun).not.toHaveBeenCalled();
  });

  it('never reads comments for a PR that is not yet hung — pay for it only when needed', () => {
    const readComments = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments, now: Date.parse('2026-09-25T16:40:00Z'),
    });
    expect(readComments).not.toHaveBeenCalled();
    expect(result.dispatch).toEqual([]);
  });

  it('applies exactly one cancel+rerun and posts the durable marker comment, when apply: true', () => {
    const readOpenPrs = () => [PR_2636_HUNG];
    const readComments = vi.fn(() => []);
    const cancelAndRerun = vi.fn(() => ({ ok: true, action: 'cancelled-and-rerun' }));
    const postComment = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs, readComments, cancelAndRerun, postComment, now: NOW, apply: true,
    });
    expect(cancelAndRerun).toHaveBeenCalledTimes(1);
    expect(cancelAndRerun).toHaveBeenCalledWith(36161558017, { repo: null });
    expect(postComment).toHaveBeenCalledWith(2636, {
      repo: null, runId: 36161558017, headSha: 'deadbeef2636', jobName: 'test-shard (1)',
      kind: 'hung-cancel-rerun', ok: true, action: 'cancelled-and-rerun', error: null,
    });
    expect(result.applied).toEqual([expect.objectContaining({ prNumber: 2636, runId: 36161558017, ok: true, action: 'cancelled-and-rerun' })]);
  });

  // LIVE 2026-09-25, orchestrator-flagged: the ORIGINAL version of this pass only posted (and therefore only
  // COUNTED) a SUCCESSFUL cancel+rerun. Live against #2636, the GitHub App token lacked `actions:write`, so
  // `gh run cancel` failed on EVERY tick, the marker was never posted, the durable per-sha count stayed 0
  // forever, and this pass would have retried the identical doomed call every 2 minutes indefinitely. Fixed:
  // the marker (and therefore the count) is posted on EVERY attempt, success or failure.
  it('POSTS the marker comment even when the cancel+rerun itself FAILED — a failed attempt still counts toward the cap', () => {
    const cancelAndRerun = vi.fn(() => ({ ok: false, action: 'cancel-failed', error: 'boom' }));
    const postComment = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments: () => [], cancelAndRerun, postComment, now: NOW, apply: true,
    });
    expect(postComment).toHaveBeenCalledWith(2636, expect.objectContaining({ ok: false, action: 'cancel-failed', error: 'boom' }));
    expect(result.applied).toEqual([expect.objectContaining({ prNumber: 2636, ok: false, action: 'cancel-failed', error: 'boom' })]);
  });

  // 2026-09-25 18:55 ET correction (#4075/#3383): once the GitHub App token got `actions:write`, a cap-hit run
  // is no longer left refusing forever — it is cancelled (never re-run, via `cancelOnly`, the SAME primitive
  // `repeat-hang` already uses) and handed to ci-heal instead.
  it('a run whose cancel+rerun keeps FAILING still trips the cap after maxRetriesPerSha attempts, then escalates via cancelOnly — never hammers gh with another rerun', () => {
    // Simulates tick N+1 reading back the durable failure markers ticks 1..maxRetriesPerSha posted.
    const readComments = () => [
      { body: buildHungCiComment({ headSha: 'deadbeef2636', jobName: 'test-shard (1)', ok: false, action: 'cancel-failed', error: 'permission denied' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'deadbeef2636', jobName: 'test-shard (1)', ok: false, action: 'cancel-failed', error: 'permission denied' }), author: { login: 'web-everything' } },
    ];
    const cancelAndRerun = vi.fn();
    const cancelOnly = vi.fn(() => ({ ok: true, action: 'cancelled-no-rerun' }));
    const postComment = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments, cancelAndRerun, cancelOnly, postComment, now: NOW, apply: true, maxRetriesPerSha: 2,
    });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2636, kind: 'hung-cap-escalate' })]);
    expect(result.refusals).toEqual([]);
    expect(cancelAndRerun).not.toHaveBeenCalled();
    expect(cancelOnly).toHaveBeenCalledWith(36161558017, expect.objectContaining({ repo: null }));
    expect(postComment).toHaveBeenCalled();
  });

  it('dispatches hung-cap-escalate (cancelOnly, never cancelAndRerun) once the durable per-sha comment count already hit the cap', () => {
    const readComments = () => [
      { body: buildHungCiComment({ headSha: 'deadbeef2636' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'deadbeef2636' }), author: { login: 'web-everything' } },
    ];
    const cancelAndRerun = vi.fn();
    const cancelOnly = vi.fn(() => ({ ok: true, action: 'cancelled-no-rerun' }));
    const postComment = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments, cancelAndRerun, cancelOnly, postComment, now: NOW, apply: true, maxRetriesPerSha: 2,
    });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2636, kind: 'hung-cap-escalate' })]);
    expect(result.refusals).toEqual([]);
    expect(cancelAndRerun).not.toHaveBeenCalled();
    expect(cancelOnly).toHaveBeenCalledTimes(1);
    expect(postComment).toHaveBeenCalled();
  });

  it('a NEW push (different head sha) starts the SHA cap fresh — the old sha\'s exhausted count never carries over', () => {
    const readComments = () => [
      { body: buildHungCiComment({ headSha: 'an-old-sha', jobName: 'some-other-job' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'an-old-sha', jobName: 'some-other-job' }), author: { login: 'web-everything' } },
    ];
    const cancelAndRerun = vi.fn(() => ({ ok: true, action: 'cancelled-and-rerun' }));
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments, cancelAndRerun, postComment: vi.fn(), now: NOW, apply: true, maxRetriesPerSha: 2,
    });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2636, attempts: 0, kind: 'hung-cancel-rerun' })]);
    expect(cancelAndRerun).toHaveBeenCalledTimes(1);
  });

  // LIVE 2026-09-25, orchestrator-flagged: #2636's `test-shard (1)` hung twice across two different shas.
  it('routes a repeat-hang dispatch to cancelOnly, never cancelAndRerun, and posts the escalation marker', () => {
    const readComments = () => [
      // a PRIOR attempt on this SAME job, against a DIFFERENT (now-superseded) sha — the repeat-hang signal.
      { body: buildHungCiComment({ headSha: 'an-old-sha', jobName: 'test-shard (1)' }), author: { login: 'web-everything' } },
    ];
    const cancelAndRerun = vi.fn();
    const cancelOnly = vi.fn(() => ({ ok: true, action: 'cancelled-no-rerun' }));
    const postComment = vi.fn();
    const result = sweepHungCiRecovery({
      readOpenPrs: () => [PR_2636_HUNG], readComments, cancelAndRerun, cancelOnly, postComment, now: NOW, apply: true,
    });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2636, kind: 'repeat-hang' })]);
    expect(cancelOnly).toHaveBeenCalledWith(36161558017, { repo: null });
    expect(cancelAndRerun).not.toHaveBeenCalled();
    expect(postComment).toHaveBeenCalledWith(2636, expect.objectContaining({ kind: 'repeat-hang', ok: true, action: 'cancelled-no-rerun' }));
    expect(result.applied).toEqual([expect.objectContaining({ kind: 'repeat-hang', ok: true, action: 'cancelled-no-rerun' })]);
  });
});

describe('ci-red-recovery-watch — countHungCiCommentsByJob', () => {
  it('counts a trusted marker naming this job, ACROSS different shas — a rebase must never reset this count', () => {
    const comments = [
      { body: buildHungCiComment({ headSha: 'sha-1', jobName: 'test-shard (1)' }), author: { login: 'web-everything' } },
      { body: buildHungCiComment({ headSha: 'sha-2', jobName: 'test-shard (1)' }), author: { login: 'web-everything' } }, // different sha, SAME job — still counts
      { body: buildHungCiComment({ headSha: 'sha-2', jobName: 'test-shard (2)' }), author: { login: 'web-everything' } }, // a different job — must not count
      { body: buildHungCiComment({ headSha: 'sha-2', jobName: 'test-shard (1)' }), author: { login: 'some-random-user' } }, // untrusted author
    ];
    expect(countHungCiCommentsByJob(comments, 'test-shard (1)')).toBe(2);
  });

  it('a non-array/empty input counts zero', () => {
    expect(countHungCiCommentsByJob(null)).toBe(0);
    expect(countHungCiCommentsByJob([])).toBe(0);
  });

  // ADVERSARIAL-REVIEW-CAUGHT, live 2026-09-25 (PR #2693's own round-1 review): a bare substring match let a
  // job name that is a text-PREFIX of a sibling job's name inherit that sibling's hung-attempt history — the
  // EXACT pair this PR's own p95 comment names, "test" and "test-shard (1)", reproduced here directly.
  it('never lets job "test" falsely match a marker for the DIFFERENT, sibling job "test-shard (1)" (prefix collision)', () => {
    const comments = [
      { body: buildHungCiComment({ headSha: 'sha-1', jobName: 'test-shard (1)' }), author: { login: 'web-everything' } },
    ];
    expect(countHungCiCommentsByJob(comments, 'test')).toBe(0);
    // the reverse direction (a marker for "test" must not count toward "test-shard (1)" either) — same bug class.
    const reverseComments = [
      { body: buildHungCiComment({ headSha: 'sha-1', jobName: 'test' }), author: { login: 'web-everything' } },
    ];
    expect(countHungCiCommentsByJob(reverseComments, 'test-shard (1)')).toBe(0);
    // the SAME job name, verbatim, still counts — the fix must not become so strict it breaks the real case.
    expect(countHungCiCommentsByJob(comments, 'test-shard (1)')).toBe(1);
  });
});

describe('ci-red-recovery-watch — bodyHasExactLine', () => {
  it('matches a line bounded by newlines, string-start, or string-end — never a bare substring', () => {
    expect(bodyHasExactLine('a\njob: test\nb', 'job: test')).toBe(true);
    expect(bodyHasExactLine('job: test', 'job: test')).toBe(true); // whole string, no surrounding newlines
    expect(bodyHasExactLine('a\njob: test-shard (1)\nb', 'job: test')).toBe(false); // prefix, not a whole line
    expect(bodyHasExactLine('a\nxjob: test\nb', 'job: test')).toBe(false); // not at line start either
  });

  it('a non-string body or empty/non-string line never matches', () => {
    expect(bodyHasExactLine(null, 'job: test')).toBe(false);
    expect(bodyHasExactLine('job: test', '')).toBe(false);
    expect(bodyHasExactLine('job: test', null)).toBe(false);
  });
});

describe('ci-red-recovery-watch — cancelHungRun', () => {
  it('cancels and NEVER reruns', () => {
    const calls = [];
    const exec = vi.fn((file, args) => { calls.push(args); return ''; });
    const result = cancelHungRun(36187480460, { repo: 'chalbert/web-everything', exec });
    expect(result).toEqual({ ok: true, action: 'cancelled-no-rerun' });
    expect(calls).toEqual([['run', 'cancel', '36187480460', '--repo', 'chalbert/web-everything']]);
  });

  it('reports a failed cancel with the REAL error text', () => {
    const exec = vi.fn(() => { const e = new Error('Command failed: gh run cancel 1'); e.stderr = 'HttpError: Resource not accessible by integration'; throw e; });
    const result = cancelHungRun(1, { exec });
    expect(result).toEqual({ ok: false, action: 'cancel-failed', error: 'HttpError: Resource not accessible by integration' });
  });
});

describe('ci-red-recovery-watch — describeExecError', () => {
  // LIVE 2026-09-25, orchestrator-flagged: the ORIGINAL error handling here took only
  // `e.message.split('\n')[0]`, which for a Node execFileSync failure is just "Command failed: gh run cancel
  // 123" — the actual `gh` stderr (a permission error, a "run already completed" race, etc.) was silently
  // dropped. Confirmed live against #2636's own daemon log.
  it('prefers the REAL stderr over the generic "Command failed" exec message', () => {
    const e = new Error('Command failed: gh run cancel 36187480460 --repo chalbert/web-everything');
    e.stderr = 'HttpError: Resource not accessible by integration (actions:write required)\n';
    expect(describeExecError(e)).toBe('HttpError: Resource not accessible by integration (actions:write required)');
  });

  it('accepts a Buffer stderr (execFileSync default encoding shape) exactly like a string one', () => {
    const e = new Error('Command failed');
    e.stderr = Buffer.from('run is already completing');
    expect(describeExecError(e)).toBe('run is already completing');
  });

  it('falls back to the full message (not just its first line) when stderr is empty/missing', () => {
    const e = new Error('Command failed: gh run cancel 1\nsome extra detail on a second line');
    expect(describeExecError(e)).toBe('Command failed: gh run cancel 1\nsome extra detail on a second line');
  });

  it('caps an excessively long error at 500 chars so a runaway stderr never bloats a PR comment', () => {
    const e = new Error('x');
    e.stderr = 'y'.repeat(1000);
    const described = describeExecError(e);
    expect(described.length).toBe(501); // 500 chars + the trailing ellipsis
    expect(described.endsWith('…')).toBe(true);
  });

  // ADVERSARIAL-REVIEW-CAUGHT, live 2026-09-25 (PR #2693's own round-1 review, security/information-exposure):
  // this error text is posted VERBATIM to a public PR comment (buildHungCiComment) — a token shape must never
  // reach it, even though the low-likelihood source is `gh`'s own stderr, not user input.
  it('redacts a GitHub token shape before it can reach a public PR comment', () => {
    const e = new Error('Command failed');
    e.stderr = 'HttpError: bad credentials using token ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(describeExecError(e)).toBe('HttpError: bad credentials using token ghp_<redacted>');
    expect(describeExecError(e)).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });
});

describe('ci-red-recovery-watch — redactTokenShapes', () => {
  it('redacts every GitHub token prefix shape, leaving the rest of the text untouched', () => {
    expect(redactTokenShapes('token ghs_abc123XYZ here')).toBe('token ghs_<redacted> here');
    expect(redactTokenShapes('a github_pat_ABC123_xyz value')).toBe('a github_pat_<redacted> value');
    expect(redactTokenShapes('no secret here')).toBe('no secret here');
  });

  it('handles null/undefined/non-string input without throwing', () => {
    expect(redactTokenShapes(null)).toBe('');
    expect(redactTokenShapes(undefined)).toBe('');
  });
});

describe('ci-red-recovery-watch — formatHungReport', () => {
  it('prints one line per dispatch/refusal/applied, WITH the reason on both dispatch and applied lines', () => {
    const report = formatHungReport({
      dispatch: [{ prNumber: 2636, runId: 36161558017, kind: 'hung-cancel-rerun', why: 'stuck 3h' }],
      refusals: [{ prNumber: 9001, kind: 'hung-cap-exhausted', why: 'cap hit' }],
      applied: [{ prNumber: 2636, runId: 36161558017, ok: true, action: 'cancelled-and-rerun', why: 'stuck 3h' }],
    });
    expect(report).toContain('hung-cancel-rerun PR #2636 run 36161558017 — stuck 3h');
    expect(report).toContain('hung-cap-exhausted PR #9001 — cap hit');
    expect(report).toContain('applied: cancelled-and-rerun run 36161558017 (PR #2636) — stuck 3h');
  });

  it('prints a repeat-hang dispatch under its OWN kind, never mislabelled as hung-cancel-rerun', () => {
    const report = formatHungReport({
      dispatch: [{ prNumber: 2636, runId: 36187480460, kind: 'repeat-hang', why: 'job hung twice' }],
      refusals: [], applied: [],
    });
    expect(report).toContain('repeat-hang PR #2636 run 36187480460 — job hung twice');
    expect(report).not.toContain('hung-cancel-rerun');
  });
});

// ── MISSING-CI-RUN RECOVERY (xi4od2p, #4075/#3383) — fixture is PR chalbert/web-everything#2729's REAL state ──
describe('ci-red-recovery-watch — defaultReadRequiredContexts / defaultReadHeadCommittedAt', () => {
  it('reads the live required contexts off branch protection', () => {
    const exec = vi.fn(() => '["test","smoke","daemon-soak"]');
    const contexts = defaultReadRequiredContexts({ repo: 'chalbert/web-everything', branch: 'main', exec });
    expect(contexts).toEqual(['test', 'smoke', 'daemon-soak']);
    expect(exec).toHaveBeenCalledWith('gh', ['api', 'repos/chalbert/web-everything/branches/main/protection', '--jq', '.required_status_checks.contexts'], expect.anything());
  });

  it('falls back to the default set on a read failure — never guesses a wider set than confirmed', () => {
    const exec = vi.fn(() => { throw new Error('403'); });
    expect(defaultReadRequiredContexts({ repo: 'chalbert/web-everything', exec })).toEqual(['test']);
  });

  it('reads a head commit\'s own committed date', () => {
    const exec = vi.fn(() => '2026-09-26T14:20:26Z\n');
    const date = defaultReadHeadCommittedAt('19889a0edecfdf25794d39a868ff48f0860c6d39', { repo: 'chalbert/web-everything', exec });
    expect(date).toBe('2026-09-26T14:20:26Z');
    expect(exec).toHaveBeenCalledWith('gh', ['api', 'repos/chalbert/web-everything/commits/19889a0edecfdf25794d39a868ff48f0860c6d39', '--jq', '.commit.committer.date'], expect.anything());
  });

  it('returns null on a missing sha/repo or a read failure, never throws', () => {
    expect(defaultReadHeadCommittedAt(null, { repo: 'x' })).toBeNull();
    expect(defaultReadHeadCommittedAt('sha', { repo: null })).toBeNull();
    const exec = vi.fn(() => { throw new Error('boom'); });
    expect(defaultReadHeadCommittedAt('sha', { repo: 'x', exec })).toBeNull();
  });
});

describe('ci-red-recovery-watch — triggerCiForPr', () => {
  it('prefers PUT /pulls/{n}/update-branch when the plan says preferUpdateBranch', () => {
    const exec = vi.fn(() => '');
    const result = triggerCiForPr({ prNumber: 2729, headRefName: 'lane/x', preferUpdateBranch: true }, { repo: 'chalbert/web-everything', exec });
    expect(result).toEqual({ ok: true, action: 'update-branch' });
    expect(exec).toHaveBeenCalledWith('gh', ['api', '-X', 'PUT', 'repos/chalbert/web-everything/pulls/2729/update-branch'], expect.anything());
  });

  it('falls back to gh workflow run on the PR\'s own branch when not behind main', () => {
    const exec = vi.fn(() => '');
    const result = triggerCiForPr({ prNumber: 2729, headRefName: 'lane/4166-x', preferUpdateBranch: false }, { repo: 'chalbert/web-everything', exec });
    expect(result).toEqual({ ok: true, action: 'workflow-dispatch' });
    expect(exec).toHaveBeenCalledWith('gh', ['workflow', 'run', 'CI', '--ref', 'lane/4166-x', '--repo', 'chalbert/web-everything'], expect.anything());
  });

  it('reports a failed trigger with its real error text, never throwing', () => {
    const exec = vi.fn(() => { throw Object.assign(new Error('Command failed'), { stderr: 'workflow not found' }); });
    const result = triggerCiForPr({ prNumber: 1, headRefName: 'lane/x', preferUpdateBranch: false }, { exec });
    expect(result).toEqual({ ok: false, action: 'workflow-dispatch', error: 'workflow not found' });
  });
});

describe('ci-red-recovery-watch — clearStaleCheckingLabel', () => {
  it('removes the checking label when present', () => {
    const exec = vi.fn(() => '');
    const cleared = clearStaleCheckingLabel(2729, { repo: 'chalbert/web-everything', exec, currentLabels: ['review:accepted', 'checking'] });
    expect(cleared).toBe(true);
    expect(exec).toHaveBeenCalledWith('gh', ['pr', 'edit', '2729', '--remove-label', 'checking', '--repo', 'chalbert/web-everything'], expect.anything());
  });

  it('is a no-op (never calls gh) when the label is not present', () => {
    const exec = vi.fn();
    const cleared = clearStaleCheckingLabel(2729, { exec, currentLabels: ['review:accepted'] });
    expect(cleared).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('ci-red-recovery-watch — sweepMissingRunRecovery (PR #2729 fixture: zero test/smoke/daemon-soak rollup entries at all)', () => {
  const REVIEW_GATE_ROLLUP = [{ __typename: 'CheckRun', name: 'review-gate', status: 'COMPLETED', conclusion: 'SUCCESS' }];
  const PR_2729 = {
    number: 2729, headRefName: 'lane/4166-check-standards-reference-checks-run-on-changed-linked-files',
    headRefOid: '19889a0edecfdf25794d39a868ff48f0860c6d39', statusCheckRollup: REVIEW_GATE_ROLLUP,
    labels: [{ name: 'review:accepted' }, { name: 'checking' }],
  };
  const NOW = Date.parse('2026-09-26T17:23:00Z');

  it('RED before the fix existed: sweepHungCiRecovery (the pre-existing pass) sees nothing to do for #2729 — buildHungCandidates skips a PR with zero CI-workflow rollup entries', () => {
    const result = sweepHungCiRecovery({ readOpenPrs: () => [PR_2729], readComments: () => [], now: NOW });
    expect(result.dispatch).toEqual([]);
    expect(result.refusals).toEqual([]);
  });

  it('GREEN after the fix: dry run (apply: false) plans trigger-ci for #2729 and touches nothing', () => {
    const readOpenPrs = vi.fn(() => [PR_2729]);
    const readRequiredContexts = () => ['test', 'smoke', 'daemon-soak'];
    const readHeadCommittedAt = () => '2026-09-26T14:20:26Z';
    const readAheadBy = () => 3;
    const readComments = () => [];
    const trigger = vi.fn();
    const clearLabel = vi.fn();
    const result = sweepMissingRunRecovery({
      readOpenPrs, readRequiredContexts, readHeadCommittedAt, readAheadBy, readComments, trigger, clearLabel, now: NOW,
    });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 2729, kind: 'trigger-ci', preferUpdateBranch: true })]);
    expect(result.applied).toEqual([]);
    expect(trigger).not.toHaveBeenCalled();
    expect(clearLabel).not.toHaveBeenCalled();
  });

  it('with --apply: triggers CI, posts the durable marker, and clears the stale checking label', () => {
    const readOpenPrs = () => [PR_2729];
    const readRequiredContexts = () => ['test', 'smoke', 'daemon-soak'];
    const readHeadCommittedAt = () => '2026-09-26T14:20:26Z';
    const readAheadBy = () => 3;
    const readComments = () => [];
    const trigger = vi.fn(() => ({ ok: true, action: 'update-branch' }));
    const postComment = vi.fn();
    const clearLabel = vi.fn(() => true);
    const result = sweepMissingRunRecovery({
      apply: true, readOpenPrs, readRequiredContexts, readHeadCommittedAt, readAheadBy, readComments,
      trigger, postComment, clearLabel, now: NOW,
    });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 2729, preferUpdateBranch: true }), expect.anything());
    expect(postComment).toHaveBeenCalledWith(2729, expect.objectContaining({ ok: true, action: 'update-branch' }));
    expect(clearLabel).toHaveBeenCalledWith(2729, expect.objectContaining({ currentLabels: ['review:accepted', 'checking'] }));
    expect(result.applied).toEqual([expect.objectContaining({ prNumber: 2729, ok: true, action: 'update-branch', labelCleared: true })]);
  });

  it('caps at the per-sha retry limit once prior attempts already failed to produce a real run', () => {
    const readOpenPrs = () => [PR_2729];
    const readRequiredContexts = () => ['test', 'smoke', 'daemon-soak'];
    const readHeadCommittedAt = () => '2026-09-26T14:20:26Z';
    const readAheadBy = () => 3;
    const readComments = () => [
      { body: '🚦 conveyor missing-run-recovery\n\nsha: 19889a0edecfdf25794d39a868ff48f0860c6d39\nattempt 1', author: { login: 'web-everything' } },
      { body: '🚦 conveyor missing-run-recovery\n\nsha: 19889a0edecfdf25794d39a868ff48f0860c6d39\nattempt 2', author: { login: 'web-everything' } },
    ];
    const trigger = vi.fn();
    const result = sweepMissingRunRecovery({
      apply: true, readOpenPrs, readRequiredContexts, readHeadCommittedAt, readAheadBy, readComments, trigger, now: NOW,
    });
    expect(result.dispatch).toEqual([]);
    expect(result.refusals).toEqual([expect.objectContaining({ prNumber: 2729, kind: 'missing-run-cap-exhausted' })]);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('never flags a PR whose required checks have actually reported', () => {
    const green = { ...PR_2729, statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }] };
    const result = sweepMissingRunRecovery({
      readOpenPrs: () => [green], readRequiredContexts: () => ['test'], now: NOW,
    });
    expect(result.dispatch).toEqual([]);
  });
});

describe('ci-red-recovery-watch — formatMissingRunReport', () => {
  it('prints one line per dispatch/refusal/applied, with the label-cleared note when relevant', () => {
    const report = formatMissingRunReport({
      dispatch: [{ prNumber: 2729, headRefName: 'lane/x', why: 'no run at all' }],
      refusals: [{ prNumber: 9001, kind: 'missing-run-cap-exhausted', why: 'cap hit' }],
      applied: [{ prNumber: 2729, ok: true, action: 'update-branch', labelCleared: true, why: 'no run at all' }],
    });
    expect(report).toContain('trigger-ci PR #2729 (lane/x) — no run at all');
    expect(report).toContain('missing-run-cap-exhausted PR #9001 — cap hit');
    expect(report).toContain('applied: update-branch PR #2729 (cleared stale checking label) — no run at all');
  });
});
