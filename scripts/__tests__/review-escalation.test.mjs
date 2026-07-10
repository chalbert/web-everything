/**
 * @file scripts/__tests__/review-escalation.test.mjs
 * @description Pure-function coverage for `scripts/lib/review-escalation.mjs`'s #2324 escalation-reason-in-body
 *   helpers: the drain augments a `review:human` PR's body with WHY a human is required (never replacing it),
 *   and a cheap marker check lets the gate verify the write actually landed.
 */
import { describe, it, expect } from 'vitest';
import { buildEscalationReasonBlock, bodyHasEscalationReason, ESCALATION_REASON_MARKER, hasUnclearedReviewLabel, REVIEW_LABELS } from '../lib/review-escalation.mjs';

describe('review-escalation — #2324 escalation-reason-in-body', () => {
  it('builds a marked block listing every reason', () => {
    const block = buildEscalationReasonBlock(['gate-self (scripts/merge-ai-prs.mjs) — human review required']);
    expect(block).toContain(ESCALATION_REASON_MARKER);
    expect(block).toContain('gate-self (scripts/merge-ai-prs.mjs) — human review required');
  });
  it('returns empty string for no/empty reasons (nothing to append)', () => {
    expect(buildEscalationReasonBlock([])).toBe('');
    expect(buildEscalationReasonBlock(undefined)).toBe('');
  });
  it('APPENDS to (never replaces) the existing body', () => {
    const existing = 'This PR does X.';
    const block = buildEscalationReasonBlock(['reason one']);
    const combined = existing + block;
    expect(combined.startsWith(existing)).toBe(true);
    expect(combined).toContain('reason one');
  });
  it('bodyHasEscalationReason detects the marker (present/absent/non-string)', () => {
    expect(bodyHasEscalationReason('some body\n\n## Escalation reason\n\n- x')).toBe(true);
    expect(bodyHasEscalationReason('plain body, no marker')).toBe(false);
    expect(bodyHasEscalationReason('')).toBe(false);
    expect(bodyHasEscalationReason(null)).toBe(false);
    expect(bodyHasEscalationReason(undefined)).toBe(false);
  });
});

describe('review-escalation — #2366 hasUnclearedReviewLabel (the concurrent-lander merge refusal)', () => {
  it('refuses a PR carrying review:pending alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }])).toBe(true);
  });
  it('refuses a PR carrying review:human alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }])).toBe(true);
  });
  it('refuses a PR carrying review:changes alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }])).toBe(true);
  });
  it('review:accepted clears it, even alongside a stale review:pending/human/changes label', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.accepted }])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }])).toBe(false);
  });
  it('a PR with no review labels at all is never refused', () => {
    expect(hasUnclearedReviewLabel([])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: 'ready-to-merge' }])).toBe(false);
  });
  it('tolerant of a missing/odd labels shape (never throws)', () => {
    expect(hasUnclearedReviewLabel(null)).toBe(false);
    expect(hasUnclearedReviewLabel(undefined)).toBe(false);
  });
  it('accepts plain string labels too (not only {name} objects)', () => {
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.pending])).toBe(true);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.accepted, REVIEW_LABELS.pending])).toBe(false);
  });
});

describe('review-escalation — #2366 hasUnclearedReviewLabel { allowPending } (the --no-review-escalation operator override)', () => {
  // allowPending: true is the `--label ... --no-review-escalation` path — the operator deliberately waived the
  // rubric to land a green-but-parked review:pending PR (#2262), so review:pending no longer refuses; but the
  // human-only / reviewer-rejected gates are NEVER waivable by this flag and must still refuse (#2285).
  it('honors the operator on review:pending (no longer refused under the override)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.pending], { allowPending: true })).toBe(false);
  });
  it('STILL refuses review:human under the override (gate-self is human-only, never waivable — #2285)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }], { allowPending: true })).toBe(true);
  });
  it('STILL refuses review:changes under the override (reviewer rejected; author must re-push)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }], { allowPending: true })).toBe(true);
  });
  it('refuses review:human even when a stale review:pending rides alongside under the override', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.human }], { allowPending: true })).toBe(true);
  });
  it('review:accepted still clears everything under the override', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
  });
  it('default (allowPending omitted / false) is the bare-sweep behaviour — review:pending still refuses', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }])).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }], { allowPending: false })).toBe(true);
  });
});
