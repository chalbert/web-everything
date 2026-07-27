/**
 * @file scripts/conveyor/__tests__/rearm-review.test.mjs
 * @description Pins the PURE re-arm decision for the conveyor fix agent (WE #2630). `decideRearm` swaps a
 *   repaired `review:changes` bounce back to `review:pending` for re-review — and enforces the #2630 invariant
 *   in the pure core (unbypassable): it NEVER emits `review:accepted` and NEVER removes `review:human`. So the
 *   strongest thing an auto-fix can do is re-arm the review, never clear it. Also pins idempotency (a PR with
 *   no `review:changes` refuses) and the `presentRemoveLabels` narrowing.
 */
import { describe, it, expect } from 'vitest';
import { decideRearm, presentRemoveLabels, countRearmComments, REARM_COMMENT_MARKER } from '../rearm-review.mjs';
import { REVIEW_LABELS } from '../../lib/review-escalation.mjs';

const lbl = (...names) => names.map((name) => ({ name }));

describe('decideRearm — the pure re-arm swap (#2630)', () => {
  it('re-arms a plain review:changes bounce → review:pending, dropping review:changes', () => {
    const d = decideRearm({ currentLabels: lbl(REVIEW_LABELS.changes) });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]);
    expect(d.keepsHuman).toBe(false);
  });

  it('NEVER emits review:accepted — the fix agent cannot clear the review', () => {
    const d = decideRearm({ currentLabels: lbl(REVIEW_LABELS.changes) });
    expect(d.addLabel).not.toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.accepted);
  });

  it('KEEPS review:human on a gate-self bounce — never self-clears the human gate', () => {
    const d = decideRearm({ currentLabels: lbl(REVIEW_LABELS.human, REVIEW_LABELS.changes) });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]); // review:human is NOT in the removals
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
    expect(d.keepsHuman).toBe(true);
  });

  it('refuses (idempotent no-op) when there is no review:changes to re-arm', () => {
    // e.g. already re-armed (review:pending), or a plain human-parked PR — nothing to hand back.
    expect(decideRearm({ currentLabels: lbl(REVIEW_LABELS.pending) }).allowed).toBe(false);
    expect(decideRearm({ currentLabels: lbl(REVIEW_LABELS.human) }).allowed).toBe(false);
    expect(decideRearm({ currentLabels: [] }).allowed).toBe(false);
    expect(decideRearm({}).allowed).toBe(false);
  });

  it('tolerates the bare-string label shape too (not just {name})', () => {
    const d = decideRearm({ currentLabels: [REVIEW_LABELS.changes] });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
  });
});

describe('countRearmComments — the DURABLE, restart-surviving auto-fix attempt count (#2643)', () => {
  const rearm = (extra = '') => ({ body: `${REARM_COMMENT_MARKER}\n\nThe \`review:changes\` bounce was repaired${extra}` });

  it('counts one re-arm comment per completed auto-fix cycle', () => {
    expect(countRearmComments([rearm()])).toBe(1);
    expect(countRearmComments([rearm(' a'), rearm(' b'), rearm(' c')])).toBe(3);
  });

  it('ignores non-re-arm comments (only the marker line counts)', () => {
    const comments = [rearm(), { body: 'LGTM, one nit below' }, { body: 'please fix the typo' }, rearm(' 2')];
    expect(countRearmComments(comments)).toBe(2);
  });

  it('is 0 for a PR with no re-arm comments — the fresh-PR / never-bounced case', () => {
    expect(countRearmComments([])).toBe(0);
    expect(countRearmComments([{ body: 'a human review comment' }])).toBe(0);
  });

  it('does NOT inflate the count when a human QUOTES the re-arm comment mid-body', () => {
    // A reply that embeds the marker deeper in the text must not read as a fresh auto-fix.
    expect(countRearmComments([{ body: `> ${REARM_COMMENT_MARKER}\n\nreplying to this` }])).toBe(0);
  });

  it('tolerates leading whitespace on the marker line (gh renders can pad)', () => {
    expect(countRearmComments([{ body: `\n  ${REARM_COMMENT_MARKER}\n\nbody` }])).toBe(1);
  });

  it('tolerates the bare-string comment shape too, and non-array input → 0', () => {
    expect(countRearmComments([REARM_COMMENT_MARKER])).toBe(1);
    expect(countRearmComments(null)).toBe(0);
    expect(countRearmComments(undefined)).toBe(0);
    expect(countRearmComments('not an array')).toBe(0);
  });
});

describe('presentRemoveLabels — narrow removals to labels the PR actually carries', () => {
  it('keeps only requested removals present on the PR (never hands gh an absent label)', () => {
    expect(presentRemoveLabels([REVIEW_LABELS.changes], lbl(REVIEW_LABELS.changes))).toEqual([REVIEW_LABELS.changes]);
    expect(presentRemoveLabels([REVIEW_LABELS.changes], lbl(REVIEW_LABELS.pending))).toEqual([]);
    expect(presentRemoveLabels([], lbl(REVIEW_LABELS.changes))).toEqual([]);
  });
});
