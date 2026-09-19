/**
 * @file scripts/conveyor/__tests__/advisory-round-count.test.mjs
 * @description Pins {@link countAdvisoryComments} (#3383 mechanical-dispatcher) — the durable, restart-surviving
 *   count of how many advisory-panel rounds have already run against a `review:human` PR. Mirrors
 *   `rearm-review.test.mjs`'s own `countRearmComments` cases, for the sibling counter this item adds.
 */
import { describe, it, expect } from 'vitest';
import { countAdvisoryComments, ADVISORY_NOTE_MARKER } from '../advisory-round-count.mjs';

describe('countAdvisoryComments — the DURABLE advisory-round count (#3383)', () => {
  const advisory = (extra = '') => ({ body: `${ADVISORY_NOTE_MARKER} This PR carries \`review:human\`${extra}` });

  it('counts one advisory comment per completed round', () => {
    expect(countAdvisoryComments([advisory()])).toBe(1);
    expect(countAdvisoryComments([advisory(' a'), advisory(' b'), advisory(' c')])).toBe(3);
  });

  it('ignores non-advisory comments (only the marker line counts)', () => {
    const comments = [advisory(), { body: 'LGTM, one nit below' }, { body: 'please fix the typo' }, advisory(' 2')];
    expect(countAdvisoryComments(comments)).toBe(2);
  });

  it('is 0 for a PR with no advisory comments at all', () => {
    expect(countAdvisoryComments([])).toBe(0);
    expect(countAdvisoryComments([{ body: 'a human review comment' }])).toBe(0);
    expect(countAdvisoryComments(null)).toBe(0);
    expect(countAdvisoryComments(undefined)).toBe(0);
  });

  it('does NOT inflate the count when a human QUOTES the advisory comment mid-body', () => {
    expect(countAdvisoryComments([{ body: `> ${ADVISORY_NOTE_MARKER}\n\nreplying to this` }])).toBe(0);
  });

  it('tolerates leading whitespace on the marker line (gh renders can pad)', () => {
    expect(countAdvisoryComments([{ body: `\n  ${ADVISORY_NOTE_MARKER}\n\nbody` }])).toBe(1);
  });

  it('tolerates the bare-string comment shape too, not just {body}', () => {
    expect(countAdvisoryComments([`${ADVISORY_NOTE_MARKER} plain string comment`])).toBe(1);
  });
});
