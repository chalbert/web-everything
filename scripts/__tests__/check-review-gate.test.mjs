/**
 * @file scripts/__tests__/check-review-gate.test.mjs
 * @description #2412 Layer 5 — the pure decision behind the required-status-check backstop
 *   (`we:scripts/check-review-gate.mjs`, wired into CI by `.github/workflows/review-gate.yml`): does this PR's
 *   label set carry a review hold? Only the exported pure `reviewGateVerdict` is unit-tested here; the CLI/`gh`
 *   wiring around it is a thin, untested shell (same split as every other CLI in this repo).
 */
import { describe, it, expect } from 'vitest';
import { reviewGateVerdict } from '../check-review-gate.mjs';
import { REVIEW_LABELS, REVIEW_HOLD_LABELS } from '../lib/review-escalation.mjs';

describe('reviewGateVerdict (#2412 Layer 5 — required-check backstop against a manual gh pr merge bypass)', () => {
  it('is clear when the PR carries no labels at all', () => {
    expect(reviewGateVerdict([])).toEqual({ held: false, holdLabels: [] });
    expect(reviewGateVerdict(undefined)).toEqual({ held: false, holdLabels: [] });
  });

  it('is clear for an unrelated label set (e.g. ready-to-merge with no hold)', () => {
    expect(reviewGateVerdict(['ready-to-merge']).held).toBe(false);
  });

  it.each(REVIEW_HOLD_LABELS)('is held when the PR carries the hold label %s', (label) => {
    const verdict = reviewGateVerdict([label]);
    expect(verdict.held).toBe(true);
    expect(verdict.holdLabels).toEqual([label]);
  });

  it('is clear for review:accepted — an accept CLEARS a hold, it is not one itself', () => {
    expect(reviewGateVerdict([REVIEW_LABELS.accepted]).held).toBe(false);
  });

  it('is clear for redteam:accepted — an orthogonal sign-off, not a hold', () => {
    expect(reviewGateVerdict([REVIEW_LABELS.redteamAccepted]).held).toBe(false);
  });

  it('accepts the GitHub API label shape ({name}), not just bare strings', () => {
    const verdict = reviewGateVerdict([{ name: REVIEW_LABELS.human, color: 'ededed' }]);
    expect(verdict.held).toBe(true);
    expect(verdict.holdLabels).toEqual([REVIEW_LABELS.human]);
  });

  it('names every hold label present, not just the first', () => {
    // Not a realistic PR state (the labels are mutually exclusive in practice), but the reader must not stop
    // at the first match — a caller reporting "why" should see the whole set.
    const verdict = reviewGateVerdict([REVIEW_LABELS.human, REVIEW_LABELS.pending]);
    expect(verdict.held).toBe(true);
    expect(verdict.holdLabels.sort()).toEqual([REVIEW_LABELS.human, REVIEW_LABELS.pending].sort());
  });

  it('ignores an unlabeled/malformed entry rather than throwing', () => {
    expect(() => reviewGateVerdict([null, {}, 42, REVIEW_LABELS.human])).not.toThrow();
    expect(reviewGateVerdict([null, {}, 42, REVIEW_LABELS.human]).held).toBe(true);
  });
});
