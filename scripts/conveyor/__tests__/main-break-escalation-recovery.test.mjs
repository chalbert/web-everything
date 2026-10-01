import { describe, it, expect, vi } from 'vitest';
import { buildCiHealEscalationComment, latestCiHealEscalationForHead } from '../ci-heal-escalation-mark.mjs';
import { isMainGreenFixOwed } from '../main-red-recovery.mjs';
import { sweepCiRedRecovery } from '../ci-red-recovery-watch.mjs';
import { planReconcile } from '../reconcile-core.mjs';

const headSha = '22cf2a91a071c0d462438c29600bae303a7be7f0';
// Exact reason and timestamp read from #3239's trusted escalation comment.
const comment = {
  author: { login: 'web-everything' }, createdAt: '2026-10-01T01:12:17Z',
  body: buildCiHealEscalationComment({ headSha, outcome: 'needs-human',
    reason: "required test-shard 4 red on unrelated probation-build-run.test.mjs ('replays incident #4389' gate-red vs opened-pr); PR diff is one backlog card; reproduces after rebase onto main; no open system fix found" }),
};
const green = { name: 'test', conclusion: 'success', status: 'completed',
  head_sha: 'new-main', completed_at: '2026-10-01T02:00:00Z' };
const facts = { failingCheckName: 'test', headSha, comments: [comment],
  mainLatestCheckRuns: [green], prContainsMainGreenSha: false,
  mergeBaseCheckRuns: [], mergeBaseRunConclusion: 'cancelled' };
const pr = { number: 3239, state: 'OPEN', headRefName: 'lane/card', headRefOid: headSha,
  labels: [{ name: 'ci:failed' }, { name: 'review-status:needs-human' }], mergeStateStatus: 'BLOCKED',
  comments: [comment], statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'FAILURE',
    completedAt: '2026-10-01T01:07:36Z' }] };

describe('main recovery after #3239 CI-heal escalation', () => {
  it('routes reconcile to recovery before the terminal escalation, without weakening required checks', () => {
    const result = planReconcile({ prs: [{ ...pr, requiredCheckName: 'test',
      requiredCheckCompletedAt: pr.statusCheckRollup[0].completedAt, aheadByOnMain: 5,
      prContainsMainGreenSha: false, mergeBaseCheckRuns: [], mergeBaseRunConclusion: 'cancelled' }],
      agents: [], requiredChecks: ['test'], mainLatestCheckRuns: [green], mainRedWindows: [] });
    expect(result.refusals.map(r => r.kind)).toEqual(['owed-ci-rerun']);
    expect(result.dispatch).toEqual([]);
  });

  it('refreshes through the existing IO path; only the successful new head supersedes the escalation', () => {
    const refresh = vi.fn(() => ({ ok: true, action: 'rebased', newCommit: 'fresh-head' }));
    const result = sweepCiRedRecovery({ apply: true, readOpenPrs: () => [pr],
      readRequiredContexts: () => ['test'], readMainRuns: () => [], readAheadBy: () => 5,
      readMainLatestCheckRuns: () => [green], readMainGreenFixFacts: () => ({ prContainsMainGreenSha: false, mergeBaseCheckRuns: [], mergeBaseRunConclusion: 'cancelled' }),
      readComments: () => [comment], refresh, postComment: vi.fn(), reconcileAcceptance: vi.fn() });
    expect(result.dispatch).toEqual([expect.objectContaining({ prNumber: 3239, kind: 'rebase-onto-main' })]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(latestCiHealEscalationForHead([comment], headSha)).not.toBeNull();
    expect(latestCiHealEscalationForHead([comment], result.applied[0].newCommit)).toBeNull();
  });

  it('also reads #3241’s explicit reproduction on main, scoped to the test aggregate', () => {
    const other = { ...comment, body: buildCiHealEscalationComment({ headSha, outcome: 'needs-human',
      reason: "red is main's own break: probation-build-run.test.mjs (incident #4389 replay) fails on main bc9db934 too; PR only edits one backlog card, already up to date with main" }) };
    expect(isMainGreenFixOwed({ ...facts, comments: [other] })).toBe(true);
    expect(isMainGreenFixOwed({ ...facts, comments: [other], failingCheckName: 'smoke',
      mainLatestCheckRuns: [{ ...green, name: 'smoke' }] })).toBe(false);
  });

  it('preserves the terminal escalation when refresh fails and enforces the retry cap', () => {
    const refresh = vi.fn(() => ({ ok: false, action: 'error', error: 'conflict' }));
    const postComment = vi.fn();
    const options = { apply: true, readOpenPrs: () => [pr],
      readRequiredContexts: () => ['test'], readMainRuns: () => [], readAheadBy: () => 5,
      readMainLatestCheckRuns: () => [green], readMainGreenFixFacts: () => ({
        prContainsMainGreenSha: false, mergeBaseCheckRuns: [], mergeBaseRunConclusion: 'cancelled',
      }), readComments: () => [comment], refresh, postComment, reconcileAcceptance: vi.fn() };
    const failed = sweepCiRedRecovery(options);
    expect(failed.applied[0].ok).toBe(false);
    expect(postComment).toHaveBeenCalledWith(3239, expect.objectContaining({ ok: false, headSha }));
    expect(latestCiHealEscalationForHead([comment], headSha)).not.toBeNull();
    expect(options.reconcileAcceptance).not.toHaveBeenCalled();
    refresh.mockClear();
    const capped = sweepCiRedRecovery({ ...options, maxRebaseRetriesPerSha: 0 });
    expect(capped.refusals[0].kind).toBe('rebase-cap-exhausted');
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    { comments: [{ ...comment, author: { login: 'outsider' } }] },
    { headSha: 'another-head' }, { failingCheckName: 'smoke' },
    { mergeBaseCheckRuns: [green] },
    { prContainsMainGreenSha: true }, { prContainsMainGreenSha: null },
    { mainLatestCheckRuns: [{ ...green, conclusion: 'failure' }] },
    { mainLatestCheckRuns: [{ ...green, completed_at: comment.createdAt }] },
    { mainLatestCheckRuns: [{ ...green, completed_at: undefined }] },
    { comments: [{ ...comment, body: buildCiHealEscalationComment({ headSha, outcome: 'needs-human', reason: 'PR change breaks test; requires design judgment' }) }] },
  ])('keeps escalation terminal without positive recovery evidence: %j', overrides => {
    expect(isMainGreenFixOwed({ ...facts, ...overrides })).toBe(false);
  });

  it('uses the latest escalation, never an older main attribution over a new own-change diagnosis', () => {
    const newer = { ...comment, body: buildCiHealEscalationComment({ headSha, outcome: 'needs-human', reason: 'PR code is broken' }) };
    expect(isMainGreenFixOwed({ ...facts, comments: [comment, newer] })).toBe(false);
  });
});
