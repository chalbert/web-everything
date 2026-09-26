/**
 * @file scripts/conveyor/__tests__/reconcile-core-ci-heal-exhausted-reason.test.mjs
 * @description #4191 (epic #4075/#3383) — the ONE field this card's own file scope allows on `reconcile-core.mjs`:
 *   the `ci-heal-exhausted` note now carries `lastFailureReason` (the actual failing check name(s), not just an
 *   attempt count), so a durable PR comment built from it reads "needs your decision: fix attempts exhausted",
 *   WITH the last failure reason — the operator's own brief (we:backlog/4191-*.md).
 */
import { describe, it, expect } from 'vitest';
import { planReconcile, CI_HEAL_ROUND_CAP } from '../reconcile-core.mjs';
import { buildCiHealComment } from '../ci-heal-mark.mjs';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const AUTOMATION = { login: 'web-everything' };
const lbl = (...names) => names.map((name) => ({ name }));

const exhaustedComments = () => Array.from(
  { length: CI_HEAL_ROUND_CAP },
  () => ({ body: buildCiHealComment({ reason: 'red-ci' }), author: AUTOMATION }),
);

describe('ci-heal-exhausted note — lastFailureReason (#4191)', () => {
  it('names the actual failing required check, not just the attempt count', () => {
    const pr = {
      number: 2636, state: 'OPEN', labels: lbl('ci:failed'), mergeStateStatus: 'CLEAN',
      statusCheckRollup: [
        { name: 'test-shard (2)', status: 'COMPLETED', conclusion: 'FAILURE' },
        { name: 'smoke', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ],
      comments: exhaustedComments(),
    };
    const plan = planReconcile({ prs: [pr], agents: [], now: NOW });
    expect(plan.notes).toEqual([expect.objectContaining({
      kind: 'ci-heal-exhausted', prNumber: 2636, lastFailureReason: 'test-shard (2)',
    })]);
    expect(plan.notes[0].text).toContain('Last failure: test-shard (2)');
  });

  it('joins more than one failing check name', () => {
    const pr = {
      number: 2636, state: 'OPEN', labels: lbl('ci:failed'), mergeStateStatus: 'CLEAN',
      statusCheckRollup: [
        { name: 'test-shard (1)', status: 'COMPLETED', conclusion: 'FAILURE' },
        { name: 'test-shard (2)', status: 'COMPLETED', conclusion: 'CANCELLED' },
      ],
      comments: exhaustedComments(),
    };
    const plan = planReconcile({ prs: [pr], agents: [], now: NOW });
    expect(plan.notes[0].lastFailureReason).toBe('test-shard (1), test-shard (2)');
  });

  it('falls back to a readable placeholder when no check name is available', () => {
    const pr = {
      number: 2636, state: 'OPEN', labels: lbl('ci:failed'), mergeStateStatus: 'CLEAN',
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
      comments: exhaustedComments(),
    };
    const plan = planReconcile({ prs: [pr], agents: [], now: NOW });
    expect(plan.notes[0].lastFailureReason).toBe('unnamed check');
  });
});
