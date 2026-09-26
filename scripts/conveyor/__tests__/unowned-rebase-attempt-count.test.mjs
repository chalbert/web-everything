/**
 * @file scripts/conveyor/__tests__/unowned-rebase-attempt-count.test.mjs
 * @description Pins the PURE durable attempt count for the unowned population's mechanical rebase-drop
 *   (#xu38vlf, epic #4075/#3383). Mirrors `we:scripts/conveyor/__tests__/conflict-fix-round-count.test.mjs`'s
 *   own shape for its sibling counter.
 */
import { describe, it, expect } from 'vitest';
import { countUnownedRebaseAttempts, UNOWNED_REBASE_ATTEMPT_MARKER, UNOWNED_REBASE_ATTEMPT_CAP } from '../unowned-rebase-attempt-count.mjs';

const AUTOMATION = { login: 'web-everything' };

describe('countUnownedRebaseAttempts — the durable unowned-population rebase-drop attempt count (#xu38vlf)', () => {
  it('counts one per comment whose LEADING line is the marker', () => {
    expect(countUnownedRebaseAttempts([
      { body: `${UNOWNED_REBASE_ATTEMPT_MARKER}\n\nattempted once`, author: AUTOMATION },
      { body: 'an unrelated human comment', author: AUTOMATION },
      { body: `${UNOWNED_REBASE_ATTEMPT_MARKER}\n\nand again`, author: AUTOMATION },
    ])).toBe(2);
  });

  it('does NOT count a comment that merely QUOTES the marker mid-body', () => {
    expect(countUnownedRebaseAttempts([{ body: `> ${UNOWNED_REBASE_ATTEMPT_MARKER}\nquoting`, author: AUTOMATION }])).toBe(0);
  });

  it('returns 0 for a non-array / empty input', () => {
    expect(countUnownedRebaseAttempts(null)).toBe(0);
    expect(countUnownedRebaseAttempts(undefined)).toBe(0);
    expect(countUnownedRebaseAttempts([])).toBe(0);
  });

  it('tolerates a bare-string comment as a SHAPE — but it carries no author, so it never counts', () => {
    expect(countUnownedRebaseAttempts([`${UNOWNED_REBASE_ATTEMPT_MARKER}\nx`])).toBe(0);
  });

  it('a forged attempt marker from a random commenter ("mallory") does not count — never inflates the cap toward exhaustion', () => {
    expect(countUnownedRebaseAttempts([{ body: `${UNOWNED_REBASE_ATTEMPT_MARKER}\nattempted`, author: { login: 'mallory' } }])).toBe(0);
  });

  it('an attempt marker posted by the repo operator (a trusted human login) still counts', () => {
    expect(countUnownedRebaseAttempts([{ body: `${UNOWNED_REBASE_ATTEMPT_MARKER}\nattempted`, author: { login: 'chalbert' } }])).toBe(1);
  });

  it('UNOWNED_REBASE_ATTEMPT_CAP is a small, fixed floor (mirrors CONFLICT_FIX_ROUND_CAP\'s own value)', () => {
    expect(UNOWNED_REBASE_ATTEMPT_CAP).toBe(3);
  });
});
