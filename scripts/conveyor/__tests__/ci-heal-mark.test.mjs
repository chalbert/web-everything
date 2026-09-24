/**
 * @file scripts/conveyor/__tests__/ci-heal-mark.test.mjs
 * @description Pins the PURE CI-heal durable-count helpers (WE #2666). Each completed CI-heal posts exactly ONE
 *   comment whose leading line is `CI_HEAL_COMMENT_MARKER`; `countCiHealComments` recovers the auto-CI-heal attempt
 *   count from the PR's own comment thread, so the retry cap survives a conveyor restart (the #2643 design, applied
 *   to the CI-health axis). Also pins that the marker leads the built comment body (posting and counting can never
 *   drift) and that only a LEADING marker counts (a human quoting it never inflates the tally).
 */
import { describe, it, expect } from 'vitest';
import {
  countCiHealComments, buildCiHealComment, CI_HEAL_COMMENT_MARKER,
  parseCiHealExecutedVendor, EXECUTED_VENDOR_MARKER_PREFIX,
} from '../ci-heal-mark.mjs';

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

// ================================================================================================
// #3850 Fork 2 — a `ci-heal` can never write a review label itself (this file's own hardest rule, unchanged),
// so the durable comment is the ONLY place the executed vendor can be recorded for a later land-seam reader.
// ================================================================================================
describe('buildCiHealComment / parseCiHealExecutedVendor (#3850 Fork 2 — the executed-vendor marker)', () => {
  it('a Claude-executed heal (the default) posts NO vendor line at all — byte-identical to every pre-#3850 comment', () => {
    const body = buildCiHealComment({ reason: 'red-ci' });
    expect(body).not.toContain(EXECUTED_VENDOR_MARKER_PREFIX);
    const bodyExplicit = buildCiHealComment({ reason: 'red-ci', executedVendor: 'claude' });
    expect(bodyExplicit).toBe(body);
  });

  it('a non-Claude-executed heal stamps its own "Executed by:" line, still leading with the same marker', () => {
    const body = buildCiHealComment({ reason: 'red-ci', executedVendor: 'codex' });
    expect(body.split('\n')[0]).toBe(CI_HEAL_COMMENT_MARKER);
    expect(body).toContain(`${EXECUTED_VENDOR_MARKER_PREFIX}codex`);
    expect(body).toContain('#3850 Fork 2');
    // Still round-trips through the existing attempt-count reader — the new line never breaks the old one.
    expect(countCiHealComments([{ body }])).toBe(1);
  });

  it('parseCiHealExecutedVendor round-trips a delegated build\'s own comment back to "codex"', () => {
    const body = buildCiHealComment({ reason: 'behind', executedVendor: 'codex' });
    expect(parseCiHealExecutedVendor([{ body }])).toBe('codex');
  });

  it('parseCiHealExecutedVendor reads a Claude-executed (unmarked) comment as "claude"', () => {
    const body = buildCiHealComment({ reason: 'red-ci' });
    expect(parseCiHealExecutedVendor([{ body }])).toBe('claude');
  });

  it('parseCiHealExecutedVendor reads PRE-#3850 comments (no vendor line at all) as "claude" — the safe, non-disruptive default for history this field predates', () => {
    expect(parseCiHealExecutedVendor([{ body: `${CI_HEAL_COMMENT_MARKER}\n\nrebased & re-pushed, no vendor line` }])).toBe('claude');
  });

  it('parseCiHealExecutedVendor reads the LATEST heal\'s vendor, not an earlier one — a stale vendor cannot outlive a fresher, different-vendor heal', () => {
    const codexBody = buildCiHealComment({ reason: 'red-ci', executedVendor: 'codex' });
    const claudeBody = buildCiHealComment({ reason: 'behind', executedVendor: 'claude' });
    expect(parseCiHealExecutedVendor([{ body: codexBody }, { body: claudeBody }])).toBe('claude');
    expect(parseCiHealExecutedVendor([{ body: claudeBody }, { body: codexBody }])).toBe('codex');
  });

  it('parseCiHealExecutedVendor ignores an unrelated comment that merely quotes the marker (no false read)', () => {
    expect(parseCiHealExecutedVendor([{ body: `> ${CI_HEAL_COMMENT_MARKER}\n${EXECUTED_VENDOR_MARKER_PREFIX}codex` }])).toBe('claude');
  });

  it('returns "claude" for a non-array / empty input', () => {
    expect(parseCiHealExecutedVendor(null)).toBe('claude');
    expect(parseCiHealExecutedVendor(undefined)).toBe('claude');
    expect(parseCiHealExecutedVendor([])).toBe('claude');
  });
});
