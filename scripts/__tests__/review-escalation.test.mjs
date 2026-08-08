/**
 * @file scripts/__tests__/review-escalation.test.mjs
 * @description Pure-function coverage for `scripts/lib/review-escalation.mjs`'s #2324 escalation-reason-in-body
 *   helpers: the drain augments a `review:human` PR's body with WHY a human is required (never replacing it),
 *   and a cheap marker check lets the gate verify the write actually landed.
 */
import { describe, it, expect } from 'vitest';
import { buildEscalationReasonBlock, bodyHasEscalationReason, ESCALATION_REASON_MARKER, hasUnclearedReviewLabel, REVIEW_LABELS, READY_TO_MERGE_LABEL, REVIEW_HOLD_LABELS, isReviewHoldLabel, readyMergeConflictsWithHold, decideParkReadyStrip, decideReviewGate } from '../lib/review-escalation.mjs';

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

describe('review-escalation — #2832 label/hold self-consistency primitives', () => {
  it('REVIEW_HOLD_LABELS is exactly the three hold labels (accepted/redteam are NOT holds)', () => {
    expect(REVIEW_HOLD_LABELS).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.changes, REVIEW_LABELS.human]);
    expect(REVIEW_HOLD_LABELS).not.toContain(REVIEW_LABELS.accepted);
  });
  it('isReviewHoldLabel is true for each hold label, false for accepted/ready/anything else', () => {
    expect(isReviewHoldLabel(REVIEW_LABELS.pending)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.changes)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.human)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.accepted)).toBe(false);
    expect(isReviewHoldLabel(READY_TO_MERGE_LABEL)).toBe(false);
    expect(isReviewHoldLabel('some:other')).toBe(false);
    expect(isReviewHoldLabel(undefined)).toBe(false);
  });
  describe('readyMergeConflictsWithHold — the contradictory (held AND ready) state', () => {
    for (const hold of ['review:pending', 'review:changes', 'review:human']) {
      it(`ready-to-merge + ${hold} → CONFLICT (must be stripped)`, () => {
        expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: hold }])).toBe(true);
      });
      it(`${hold} WITHOUT ready-to-merge → no conflict (nothing to strip)`, () => {
        expect(readyMergeConflictsWithHold([{ name: hold }])).toBe(false);
      });
    }
    it('ready-to-merge alone (no hold) → consistent, not a conflict', () => {
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }])).toBe(false);
    });
    it('review:accepted clears the hold, so ready-to-merge alongside it is consistent', () => {
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(false);
    });
    it('tolerant of a missing/odd labels shape (never throws)', () => {
      expect(readyMergeConflictsWithHold(null)).toBe(false);
      expect(readyMergeConflictsWithHold([])).toBe(false);
    });
  });
});

describe('review-escalation — #984 F2 decideParkReadyStrip (the drain park strip, keyed on OBSERVED holds)', () => {
  // THE REGRESSION THIS BLOCK EXISTS FOR. The shipped strip lived inside `if (gate.applyLabel && !DRY_RUN)`,
  // so it ran only for the two holds whose `applyLabel` decideReviewGate re-returns every pass
  // (review:pending / review:human). `review:changes` returns `wait-author` with NO applyLabel — so a PR that
  // reached `review:changes` + `ready-to-merge` stayed contradictory forever, with no sweeper (the per-pass
  // reconcile strip was deliberately dropped from #984 — see backlog `xtw8e93`). PR #984 itself was in that
  // state when the review that found this was recorded.
  it('review:changes yields NO applyLabel from decideReviewGate, yet the go-ahead is still stripped', () => {
    const labels = [REVIEW_LABELS.changes, READY_TO_MERGE_LABEL];
    const gate = decideReviewGate({ escalate: true, labels });
    // The precondition that made the applyLabel-nested strip unreachable for this hold:
    expect(gate.action).toBe('wait-author');
    expect(gate.applyLabel).toBeFalsy();
    // The OLD key, spelled out: `isReviewHoldLabel(gate.applyLabel)` is FALSE here, so the shipped strip could
    // not fire no matter how the surrounding guard was written.
    expect(isReviewHoldLabel(gate.applyLabel)).toBe(false);
    // The NEW key fires. This is the assertion that fails on the pre-hoist shape.
    expect(decideParkReadyStrip(labels, { applyLabel: gate.applyLabel })).toBe(true);
  });
  it('a review:changes PR is stripped even when the drain applies nothing at all (no applyLabel argument)', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.changes, READY_TO_MERGE_LABEL])).toBe(true);
  });

  for (const hold of REVIEW_HOLD_LABELS) {
    it(`an ALREADY-held ${hold} PR carrying the go-ahead is stripped with no applyLabel (standing reconcile)`, () => {
      expect(decideParkReadyStrip([{ name: hold }, { name: READY_TO_MERGE_LABEL }])).toBe(true);
    });
    it(`a FRESH ${hold} park (hold not yet observed) still strips — the atomic park strip survives the hoist`, () => {
      expect(decideParkReadyStrip([{ name: READY_TO_MERGE_LABEL }], { applyLabel: hold })).toBe(true);
    });
    it(`${hold} WITHOUT the go-ahead is never a strip target (nothing to remove)`, () => {
      expect(decideParkReadyStrip([{ name: hold }])).toBe(false);
      expect(decideParkReadyStrip([], { applyLabel: hold })).toBe(false);
    });
  }

  // THE HOISTING SAFETY PROPERTY the review asked to be proven: a legitimately QUEUED PR must never be
  // un-queued by the widened key.
  it('a legitimately queued PR (review:accepted + ready-to-merge) is NEVER stripped', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(false);
    // …and it does not even reach a park branch: decideReviewGate merges it.
    expect(decideReviewGate({ escalate: true, labels: [REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL] }).action).toBe('merge');
  });
  it('review:accepted clears a stale hold too — an accepted PR with a leftover hold keeps its go-ahead', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.pending, REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(false);
  });
  it('an unlabelled/clean PR carrying only the go-ahead is never stripped', () => {
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL])).toBe(false);
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL], { applyLabel: null })).toBe(false);
  });

  // #2409 — the stale-acceptance re-park REMOVES review:accepted in the same operation, so the strip decision
  // must be made against the post-park set. Without the staleAcceptance input the still-present accepted label
  // would clear the hold and the re-parked PR would keep its go-ahead.
  it('a #2409 stale-acceptance re-park strips, because it drops review:accepted in the same operation', () => {
    const labels = [REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL];
    expect(decideParkReadyStrip(labels, { applyLabel: REVIEW_LABELS.human, staleAcceptance: true })).toBe(true);
    expect(decideParkReadyStrip(labels, { applyLabel: REVIEW_LABELS.pending, staleAcceptance: true })).toBe(true);
    // …and the gate really does produce that shape.
    const gate = decideReviewGate({ escalate: true, labels, acceptedSha: 'a'.repeat(40), headSha: 'b'.repeat(40) });
    expect(gate.staleAcceptance).toBe(true);
    expect(decideParkReadyStrip(labels, { applyLabel: gate.applyLabel, staleAcceptance: gate.staleAcceptance })).toBe(true);
  });

  it('accepts plain-string and {name} label shapes alike, and never throws on an odd one', () => {
    expect(decideParkReadyStrip([{ name: REVIEW_LABELS.human }, READY_TO_MERGE_LABEL])).toBe(true);
    expect(decideParkReadyStrip(null)).toBe(false);
    expect(decideParkReadyStrip(undefined, { applyLabel: REVIEW_LABELS.human })).toBe(false);
    expect(decideParkReadyStrip([null, undefined, { name: null }, READY_TO_MERGE_LABEL], { applyLabel: REVIEW_LABELS.changes })).toBe(true);
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
