/**
 * @file scripts/conveyor/__tests__/ci-heal-mark.test.mjs
 * @description Pins the PURE CI-heal durable-count helpers (WE #2666). Each completed CI-heal posts exactly ONE
 *   comment whose leading line is `CI_HEAL_COMMENT_MARKER`; `countCiHealComments` recovers the auto-CI-heal attempt
 *   count from the PR's own comment thread, so the retry cap survives a conveyor restart (the #2643 design, applied
 *   to the CI-health axis). Also pins that the marker leads the built comment body (posting and counting can never
 *   drift) and that only a LEADING marker counts (a human quoting it never inflates the tally). #3383 — also pins
 *   that ONLY a trusted author (automation or the repo operator) counts at all.
 */
import { describe, it, expect } from 'vitest';
import { countCiHealComments, buildCiHealComment, CI_HEAL_COMMENT_MARKER, spawnCiHealRearm } from '../ci-heal-mark.mjs';

const AUTOMATION = { login: 'web-everything' };

describe('countCiHealComments — the durable, restart-surviving CI-heal attempt count (#2666)', () => {
  it('counts one per comment whose LEADING line is the marker', () => {
    expect(countCiHealComments([
      { body: `${CI_HEAL_COMMENT_MARKER}\n\nrebased & re-pushed once`, author: AUTOMATION },
      { body: 'an unrelated human comment', author: AUTOMATION },
      { body: `${CI_HEAL_COMMENT_MARKER}\n\nand again`, author: AUTOMATION },
    ])).toBe(2);
  });

  it('tolerates a bare-string comment array as a SHAPE — but it carries no author, so it never counts (#3383)', () => {
    expect(countCiHealComments([`${CI_HEAL_COMMENT_MARKER}\nx`, 'noise'])).toBe(0);
  });

  it('does NOT count a comment that merely QUOTES the marker mid-body (no inflation)', () => {
    expect(countCiHealComments([{ body: `> ${CI_HEAL_COMMENT_MARKER}\na human quoting it in a reply`, author: AUTOMATION }])).toBe(0);
  });

  it('returns 0 for a non-array / empty input', () => {
    expect(countCiHealComments(null)).toBe(0);
    expect(countCiHealComments(undefined)).toBe(0);
    expect(countCiHealComments([])).toBe(0);
  });

  // #3383 — adversarial coverage review, 2026-09-24: before this item's fix, ANY GitHub account could post this
  // exact leading line and inflate a PR's CI-heal round cap toward exhaustion.
  it('a forged CI-heal marker from a random commenter ("mallory") does not count', () => {
    expect(countCiHealComments([{ body: `${CI_HEAL_COMMENT_MARKER}\n\nrebased`, author: { login: 'mallory' } }])).toBe(0);
  });

  it('a CI-heal marker posted by the repo operator still counts', () => {
    expect(countCiHealComments([{ body: `${CI_HEAL_COMMENT_MARKER}\n\nrebased`, author: { login: 'chalbert' } }])).toBe(1);
  });
});

describe('buildCiHealComment — the durable comment body (#2666)', () => {
  it('leads with the marker so posting and counting share ONE source of truth', () => {
    const body = buildCiHealComment({ reason: 'red-ci' });
    expect(body.split('\n')[0]).toBe(CI_HEAL_COMMENT_MARKER);
    expect(countCiHealComments([{ body, author: AUTOMATION }])).toBe(1); // round-trips: what we post, we count
  });

  it('states that only CI was repaired — the review gate was NOT touched', () => {
    const body = buildCiHealComment({ reason: 'behind' });
    expect(body).toContain('review:human');
    expect(body.toLowerCase()).toContain('not touched');
  });
});

// #2811 — a CI-heal rebases and re-pushes the head, so a live `review:accepted` it finds is now stale. This
// hand-back re-arms it through the EXISTING `rearm-review.mjs` swap (never a second, hand-rolled label write).
describe('spawnCiHealRearm — hand a stale review:accepted back through rearm-review.mjs (#2811)', () => {
  const spy = (status = 0, stdout = '') => {
    const calls = [];
    const spawn = (cmd, argv, opts) => { calls.push({ cmd, argv, opts }); return { status, stdout, stderr: '' }; };
    return { calls, spawn };
  };

  it('shells THIS checkout\'s rearm-review.mjs with the pr, actor, and repo', () => {
    const { calls, spawn } = spy();
    const out = spawnCiHealRearm({ pr: 2811, repo: 'chalbert/web-everything', cwd: '/ws/we', spawn });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].argv[0]).toMatch(/scripts\/conveyor\/rearm-review\.mjs$/);
    expect(calls[0].argv).toContain('2811');
    expect(calls[0].argv).toContain('--actor=conveyor CI-heal agent');
    expect(calls[0].argv).toContain('--repo=chalbert/web-everything');
    expect(calls[0].opts.cwd).toBe('/ws/we');
  });

  it('a refused re-arm (nothing to re-arm — the common, no-accepted-label case) is reported, not thrown', () => {
    const { spawn } = spy(1, JSON.stringify({ ok: false, pr: 2811, reason: 'neither review:changes nor review:accepted is live' }));
    const out = spawnCiHealRearm({ pr: 2811, repo: 'chalbert/web-everything', spawn });
    expect(out.ok).toBe(false);
  });

  it('a spawn failure never throws — reported as {ok:false, reason}', () => {
    const thrower = () => { throw new Error('spawn ENOENT'); };
    expect(spawnCiHealRearm({ pr: 2811, repo: 'chalbert/web-everything', spawn: thrower })).toEqual({ ok: false, reason: 'spawn ENOENT' });
  });
});
