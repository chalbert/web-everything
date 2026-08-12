/**
 * @file scripts/__tests__/review-escalation.test.mjs
 * @description Pure-function coverage for `scripts/lib/review-escalation.mjs`'s #2324 escalation-reason-in-body
 *   helpers: the drain augments a `review:human` PR's body with WHY a human is required (never replacing it),
 *   and a cheap marker check lets the gate verify the write actually landed.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEscalationReasonBlock, bodyHasEscalationReason, ESCALATION_REASON_MARKER, hasUnclearedReviewLabel, REVIEW_LABELS, READY_TO_MERGE_LABEL, REVIEW_HOLD_LABELS, isReviewHoldLabel, readyMergeConflictsWithHold, decideParkReadyStrip, decideReviewGate, parsePolicyStamp } from '../lib/review-escalation.mjs';
import { POLICY_VERSION, POLICY_DIGEST } from '../lib/review-policy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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
  // The escalation record said WHAT fired and never WHICH RULES were in force. A threshold change therefore
  // split the history into two incomparable halves with no marker at the seam — which is why `gate-health`
  // reports `parameterSet: null` and why retrospective A/B is impossible today.
  describe('the policy stamp — which parameter set scored this PR', () => {
    it('rides the reason block and round-trips', () => {
      const block = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);
      const stamp = parsePolicyStamp(block);
      expect(stamp).not.toBeNull();
      expect(stamp.version).toBe(String(POLICY_VERSION));
      expect(stamp.digest).toBe(POLICY_DIGEST);
    });

    // An unstamped body is every PR opened before this shipped. It must stay DISTINGUISHABLE from a stamped
    // one — defaulting it to "the current set" would silently claim old PRs were scored under today's rules,
    // which is the exact false-attribution this stamp exists to prevent.
    it('reads null for an unstamped body rather than assuming the current set', () => {
      expect(parsePolicyStamp('a PR body with no stamp')).toBeNull();
      expect(parsePolicyStamp('')).toBeNull();
      expect(parsePolicyStamp(undefined)).toBeNull();
    });

    // THE LOAD-BEARING PROPERTY. `version` is hand-declared and nothing forces a bump, so it can read `1`
    // across edits that moved the thresholds. The digest is derived from the contract's bytes, so it cannot.
    // If this ever fails, the stamp has stopped tracking the thing it exists to track.
    it('the digest is derived from the contract text, so it moves when the contract does', () => {
      const contract = readFileSync(resolve(HERE, '..', 'lib', 'review-policy.contract.json'), 'utf8');
      const expected = createHash('sha256').update(contract).digest('hex').slice(0, 12);
      expect(POLICY_DIGEST).toBe(expected);
      // …and a one-character edit changes it, which `version` alone would not reflect.
      const nudged = createHash('sha256').update(`${contract} `).digest('hex').slice(0, 12);
      expect(nudged).not.toBe(POLICY_DIGEST);
    });

    it('an empty reason list still produces no block, so an unescalated PR is not stamped', () => {
      expect(buildEscalationReasonBlock([])).toBe('');
    });
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
  it('review:accepted clears it — and alongside a stale review:changes too (#2974)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.accepted }])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }])).toBe(false);
  });
  // #x9xqexm — the two HOLD pairs no longer clear. Both are producible by NO sanctioned writer (`--to=accepted`
  // and `--to=clear-human` remove `pending` as they add `accepted`, and `--to=accepted` is refused outright on a
  // `review:human` PR), so each means "the drain re-parked a stale accept" — and since #x9xqexm the drain no
  // longer deletes the accept, this NON-SCORING predicate is the only thing that reads that state. `pending` is
  // the common one: the re-park applies it whenever the fresh score is not `humanRequired` (the PR #984 shape).
  it('…but NOT alongside review:human, and NOT alongside review:pending', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }])).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(true);
    // The #2423 relief valve still waives the pending pair — an operator naming ONE PR explicitly, exactly as
    // it waives a bare review:pending. It never waives the human pair.
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(true);
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
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.accepted, REVIEW_LABELS.changes])).toBe(false);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.accepted, REVIEW_LABELS.pending])).toBe(true); // #x9xqexm
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
    it('review:accepted clears a review:changes hold, so ready-to-merge alongside it is consistent (#2974)', () => {
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }])).toBe(false);
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.accepted }])).toBe(false);
    });
    it('…but accepted + pending IS contradictory since #x9xqexm — that pair is a stale re-park, not a clearance', () => {
      // It inherits directly from `hasUnclearedReviewLabel`, which is the point: ONE hold predicate, so the
      // go-ahead strip and the merge refusal can never disagree about what a label set means.
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(true);
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
  it('review:accepted clears a leftover review:changes — that accepted PR keeps its go-ahead (#2974)', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.changes, REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(false);
  });
  it('…but a leftover review:pending next to accepted DOES strip since #x9xqexm', () => {
    // The accept no longer deletes on re-park, so `[accepted, pending]` is a live state rather than a
    // transient one — and it means the re-score found the accept stale. A held PR may not keep the go-ahead.
    expect(decideParkReadyStrip([REVIEW_LABELS.pending, REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(true);
  });
  it('an unlabelled/clean PR carrying only the go-ahead is never stripped', () => {
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL])).toBe(false);
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL], { applyLabel: null })).toBe(false);
  });

  // #2409 / #x9xqexm — a stale-acceptance re-park must strip the go-ahead. The `staleAcceptance` input shipped
  // meaning "this same park is about to REMOVE review:accepted, so do not let it clear the hold". #x9xqexm ends
  // that removal — a re-score never deletes a human's verdict — so the option's original reason is gone and its
  // narrower one (the accept is KNOWN STALE, so it may not clear the hold being written) takes over. The
  // OUTCOME must be identical either way: `hasUnclearedReviewLabel` now refuses `accepted + pending` and
  // `accepted + human` directly, which are the only labels a stale re-park applies. That redundancy is
  // deliberate — the round-2 review flagged that a reader could delete the now-pointless filter and leave the
  // go-ahead standing on a held PR, and the fix is to make the deletion HARMLESS rather than to forbid it.
  it('a #2409 stale-acceptance re-park strips — WITH the staleAcceptance filter and, since #x9xqexm, without it', () => {
    const labels = [REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL];
    for (const applyLabel of [REVIEW_LABELS.human, REVIEW_LABELS.pending]) {
      expect(decideParkReadyStrip(labels, { applyLabel, staleAcceptance: true })).toBe(true);
      expect(decideParkReadyStrip(labels, { applyLabel, staleAcceptance: false })).toBe(true);
    }
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
  it('review:accepted clears pending and a stale changes under the override (#2974: the verdict wins)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
  });
  // #x9xqexm — the ONE pair that is no longer cleared. The drain stopped DELETING a stale `review:accepted` when
  // it re-parks (deleting a human's recorded clearance was never what stopped the merge), so `accepted + human`
  // is now a state this non-scoring path can actually observe — and it must fail closed on it.
  it('review:accepted does NOT clear a co-present review:human — the pair fails closed', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }])).toBe(true);
  });
  it('default (allowPending omitted / false) is the bare-sweep behaviour — review:pending still refuses', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }])).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }], { allowPending: false })).toBe(true);
  });
});
