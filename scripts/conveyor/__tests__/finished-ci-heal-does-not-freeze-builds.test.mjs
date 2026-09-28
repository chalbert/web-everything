/**
 * @file finished-ci-heal-does-not-freeze-builds.test.mjs — end-to-end reproduction of the LIVE incident found
 * 2026-09-28 (we#2852): the build-dispatch daemon was frozen (`freeze.reasons: ['we#2852 is labelled
 * review-status:ci-heal-stalled']`) even though ci-heal-2852 had genuinely FINISHED — fix-end recorded, its
 * completion record said `status: done`, its dispatch claim was released — because
 *
 *   (1) we:scripts/conveyor/review-status-tag.mjs#deriveReviewStatus derived its `review-status:*` label from
 *       the raw `claude agents --json` `state` alone, never consulting the `selfReportedDone` fact
 *       we:scripts/conveyor/reconcile-core.mjs#markSelfReportedDone already stamps onto the SAME agent row, and
 *   (2) we:scripts/conveyor/build-dispatch-policy.mjs#planBuildDispatch let ANY `*-stalled` label on ANY open PR
 *       freeze EVERY candidate, regardless of scope.
 *
 * This wires the REAL functions from both modules (plus the real `markSelfReportedDone`) over a fixture shaped
 * exactly like the incident, so the RED state (checked out at the pre-fix revision) reproduces the frozen queue
 * byte-for-byte, and the GREEN state (this revision) proves a disjoint-scope build dispatches while a build that
 * actually touches #2852's files still correctly waits.
 */
import { describe, it, expect } from 'vitest';

import { markSelfReportedDone } from '../reconcile-core.mjs';
import { deriveReviewStatus, planStatusLabelChange } from '../review-status-tag.mjs';
import { planBuildDispatch } from '../build-dispatch-policy.mjs';

/** The exact completion record ci-heal-2852 would have written at fix-end (status:done, no infra outcome). */
function fixture() {
  const startedAt = '2026-09-28T18:00:00.000Z';
  const completionRecord = { status: 'done', outcome: 'fixed', updatedAt: '2026-09-28T19:17:00.000Z' };
  // The raw `claude agents --json` row: still `blocked` — the CLI never pruned/updated it after the session's
  // own completion record was written, exactly as the live incident's own evidence described.
  const rawAgents = [{ name: 'ci-heal-2852', state: 'blocked', startedAt }];
  const completionFor = (name) => (name === 'ci-heal-2852' ? completionRecord : null);
  const nowMs = Date.parse('2026-09-28T19:34:00.000Z'); // 3:34 PM ET evidence timestamp
  return { rawAgents, completionFor, nowMs };
}

describe('incident reproduction: a finished ci-heal session must not freeze the build queue', () => {
  it('markSelfReportedDone marks the row done, exactly as reconcile-pass.mjs#defaultReadAgents would feed it forward', () => {
    const { rawAgents, completionFor, nowMs } = fixture();
    const enriched = markSelfReportedDone(rawAgents, completionFor, nowMs);
    expect(enriched).toEqual([{ name: 'ci-heal-2852', state: 'blocked', startedAt: '2026-09-28T18:00:00.000Z', selfReportedDone: true, selfReportedOutcome: 'fixed' }]);
  });

  it('GREEN: deriveReviewStatus reads the enriched row as nothing-live, not ci-heal-stalled', () => {
    const { rawAgents, completionFor, nowMs } = fixture();
    const enriched = markSelfReportedDone(rawAgents, completionFor, nowMs);
    const status = deriveReviewStatus({ pr: 2852, agents: enriched, repo: 'we' });
    expect(status).toBeNull();
    // ... so the label plan clears the stale tag with no replacement, exactly the fix the operator needs applied.
    expect(planStatusLabelChange({ status, currentLabels: [{ name: 'review-status:ci-heal-stalled' }] }))
      .toEqual({ add: null, remove: ['review-status:ci-heal-stalled'] });
  });

  it('RED (pre-fix shape, pinned so a regression is caught): the RAW un-enriched row alone still reads ci-heal-stalled — proves the fix is the enrichment check, not a change to raw-state handling', () => {
    const { rawAgents } = fixture();
    // No markSelfReportedDone pass — the exact shape `deriveReviewStatus` saw before defaultReadAgents wired the
    // enrichment through it. `state: 'blocked'` alone is still, correctly, `ci-heal-stalled` — a session that is
    // ACTUALLY still blocked (no completion record) must keep surfacing as stalled.
    const status = deriveReviewStatus({ pr: 2852, agents: rawAgents, repo: 'we' });
    expect(status).toEqual({ role: 'ci-heal', state: 'ci-heal-stalled' });
  });

  it('GREEN end-to-end: once the label is correctly cleared, an unrelated queued build dispatches instead of freezing behind #2852', () => {
    const { rawAgents, completionFor, nowMs } = fixture();
    const enriched = markSelfReportedDone(rawAgents, completionFor, nowMs);
    const status = deriveReviewStatus({ pr: 2852, agents: enriched, repo: 'we' });
    // The corrected label state feeds back onto the PR exactly like `tagReviewStatus` would apply it — nothing
    // live, so #2852 carries NO review-status:* label at all (planStatusLabelChange's own `remove`).
    const openPrs = [{
      repo: 'we', number: 2852, headRefName: 'lane/2852-ci-heal-fix', labels: [], // label already cleared
      files: [{ repo: 'we', path: 'scripts/conveyor/review-status-tag.mjs' }],
    }];
    const plan = planBuildDispatch({
      candidates: [{ num: '4360', lane: null, scope: ['we:scripts/conveyor/build-dispatch-daemon.mjs'] }],
      openPrs,
    });
    expect(plan.freeze.frozen).toBe(false);
    expect(plan.dispatch.map((x) => x.num)).toEqual(['4360']);
  });

  it('DEMONSTRATES THE BUG DIRECTLY (still passes post-fix — this is what the freeze-label change fixes, independent of fix 1): even while a *-stalled label sits on #2852, only a build overlapping ITS files waits — every other build still dispatches, so a mislabel can no longer freeze the whole queue', () => {
    const openPrs = [{
      repo: 'we', number: 2852, headRefName: 'lane/2852-ci-heal-fix', labels: ['review-status:ci-heal-stalled'],
      files: [{ repo: 'we', path: 'scripts/conveyor/review-status-tag.mjs' }],
    }];
    const plan = planBuildDispatch({
      candidates: [
        { num: '4360', lane: null, scope: ['we:scripts/conveyor/build-dispatch-daemon.mjs'] }, // disjoint
        { num: '4361', lane: null, scope: ['we:scripts/conveyor/review-status-tag.mjs'] }, // overlaps #2852
      ],
      openPrs,
    });
    expect(plan.freeze.frozen).toBe(false);
    expect(plan.dispatch.map((x) => x.num)).toEqual(['4360']);
    expect(plan.hold.find((h) => h.num === '4361')).toMatchObject({ rule: 'scope-vs-open-prs' });
  });
});
