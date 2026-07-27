/**
 * @file scripts/conveyor/__tests__/ci-heal-mark.test.mjs
 * @description Pins the PURE CI-heal durable-count helpers (WE #2666). Each completed CI-heal posts exactly ONE
 *   comment whose leading line is `CI_HEAL_COMMENT_MARKER`; `countCiHealComments` recovers the auto-CI-heal attempt
 *   count from the PR's own comment thread, so the retry cap survives a conveyor restart (the #2643 design, applied
 *   to the CI-health axis). Also pins that the marker leads the built comment body (posting and counting can never
 *   drift) and that only a LEADING marker counts (a human quoting it never inflates the tally).
 */
import { describe, it, expect } from 'vitest';
import { countCiHealComments, buildCiHealComment, CI_HEAL_COMMENT_MARKER } from '../ci-heal-mark.mjs';

describe('countCiHealComments — the durable, restart-surviving CI-heal attempt count (#2666)', () => {
  it('counts one per comment whose LEADING line is the marker', () => {
    expect(countCiHealComments([
      { body: `${CI_HEAL_COMMENT_MARKER}\n\nrebased & re-pushed once` },
      { body: 'an unrelated human comment' },
      { body: `${CI_HEAL_COMMENT_MARKER}\n\nand again` },
    ])).toBe(2);
  });

  it('tolerates a bare-string comment array', () => {
    expect(countCiHealComments([`${CI_HEAL_COMMENT_MARKER}\nx`, 'noise'])).toBe(1);
  });

  it('does NOT count a comment that merely QUOTES the marker mid-body (no inflation)', () => {
    expect(countCiHealComments([{ body: `> ${CI_HEAL_COMMENT_MARKER}\na human quoting it in a reply` }])).toBe(0);
  });

  it('returns 0 for a non-array / empty input', () => {
    expect(countCiHealComments(null)).toBe(0);
    expect(countCiHealComments(undefined)).toBe(0);
    expect(countCiHealComments([])).toBe(0);
  });
});

describe('buildCiHealComment — the durable comment body (#2666)', () => {
  it('leads with the marker so posting and counting share ONE source of truth', () => {
    const body = buildCiHealComment({ reason: 'red-ci' });
    expect(body.split('\n')[0]).toBe(CI_HEAL_COMMENT_MARKER);
    expect(countCiHealComments([{ body }])).toBe(1); // round-trips: what we post, we count
  });

  it('states that only CI was repaired — the review gate was NOT touched', () => {
    const body = buildCiHealComment({ reason: 'behind' });
    expect(body).toContain('review:human');
    expect(body.toLowerCase()).toContain('not touched');
  });
});
