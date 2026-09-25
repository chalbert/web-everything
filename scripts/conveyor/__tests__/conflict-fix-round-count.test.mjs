/**
 * @file scripts/conveyor/__tests__/conflict-fix-round-count.test.mjs
 * @description Pins the PURE mechanical conflict-resolution round count (WE #xkmu3gv). Each completed round
 *   posts exactly ONE comment whose leading line is `CONFLICT_FIX_COMMENT_MARKER`; `countConflictFixComments`
 *   recovers the attempt count from the PR's own comment thread, keyed to its OWN round cap (never the shared
 *   negotiation cap). #3383 — also pins that ONLY a trusted author (automation or the repo operator) counts at
 *   all; no test file existed for this counter before this item.
 */
import { describe, it, expect } from 'vitest';
import { countConflictFixComments, CONFLICT_FIX_COMMENT_MARKER } from '../conflict-fix-round-count.mjs';

const AUTOMATION = { login: 'web-everything' };

describe('countConflictFixComments — the durable mechanical conflict-resolution round count (#xkmu3gv)', () => {
  it('counts one per comment whose LEADING line is the marker', () => {
    expect(countConflictFixComments([
      { body: `${CONFLICT_FIX_COMMENT_MARKER}\n\nresolved once`, author: AUTOMATION },
      { body: 'an unrelated human comment', author: AUTOMATION },
      { body: `${CONFLICT_FIX_COMMENT_MARKER}\n\nand again`, author: AUTOMATION },
    ])).toBe(2);
  });

  it('does NOT count a comment that merely QUOTES the marker mid-body', () => {
    expect(countConflictFixComments([{ body: `> ${CONFLICT_FIX_COMMENT_MARKER}\nquoting`, author: AUTOMATION }])).toBe(0);
  });

  it('returns 0 for a non-array / empty input', () => {
    expect(countConflictFixComments(null)).toBe(0);
    expect(countConflictFixComments(undefined)).toBe(0);
    expect(countConflictFixComments([])).toBe(0);
  });

  it('tolerates a bare-string comment as a SHAPE — but it carries no author, so it never counts (#3383)', () => {
    expect(countConflictFixComments([`${CONFLICT_FIX_COMMENT_MARKER}\nx`])).toBe(0);
  });

  // #3383 — adversarial coverage review, 2026-09-24: a forged marker here burns a PR's conflict-fix round cap
  // toward `cap-exhausted` with no mechanical round having actually run.
  it('a forged conflict-fix marker from a random commenter ("mallory") does not count', () => {
    expect(countConflictFixComments([{ body: `${CONFLICT_FIX_COMMENT_MARKER}\nresolved`, author: { login: 'mallory' } }])).toBe(0);
  });

  it('a conflict-fix marker posted by the repo operator still counts', () => {
    expect(countConflictFixComments([{ body: `${CONFLICT_FIX_COMMENT_MARKER}\nresolved`, author: { login: 'chalbert' } }])).toBe(1);
  });
});
