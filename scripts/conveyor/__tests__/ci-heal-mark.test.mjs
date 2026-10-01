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
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  countCiHealComments, buildCiHealComment, CI_HEAL_COMMENT_MARKER, spawnCiHealRearm, postOrOweCiHealComment, resolveHealHead,
} from '../ci-heal-mark.mjs';
import { readOwedWrites, owedWriteAlreadyLive } from '../ci-heal-owed.mjs';
import { budgetBlockedMessage } from '../../lib/gh-throttle.mjs';

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

  it('distinguishes the CI repair record from the subsequent acceptance re-arm', () => {
    const body = buildCiHealComment({ reason: 'behind' });
    expect(body).toContain('review:human');
    expect(body).toContain('a live `review:accepted` may be re-armed separately');
    expect(body).not.toContain('was NOT touched');
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

  it('spawnCiHealRearm passes --only-if=accepted by default and omits it when onlyIfAccepted:false', () => {
    const a = spy();
    spawnCiHealRearm({ pr: 2811, repo: 'chalbert/web-everything', spawn: a.spawn });
    expect(a.calls[0].argv).toContain('--only-if=accepted');
    const b = spy();
    spawnCiHealRearm({ pr: 2811, repo: 'chalbert/web-everything', onlyIfAccepted: false, spawn: b.spawn });
    expect(b.calls[0].argv).not.toContain('--only-if=accepted');
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

// we:backlog/4352 — a budget-refused heal comment is recorded OWED (head-scoped), never silently dropped.
describe('#4352 — head-scoped heal comment + owed-on-budget-refusal', () => {
  const HEAD = 'abcdef0123456789abcdef0123456789abcdef01';
  const REPO = { key: 'we', slug: 'chalbert/web-everything' };
  const budgetError = () => {
    const stderr = budgetBlockedMessage({ resource: 'graphql', until: '2026-09-27T23:00:00Z' });
    return Object.assign(new Error(`Command failed: gh pr comment\n${stderr}`), { status: 1, stderr });
  };

  it('buildCiHealComment carries `head: <sha>` on its SECOND line; the marker still leads and still counts once', () => {
    const body = buildCiHealComment({ reason: 'red-ci', headSha: HEAD.toUpperCase() });
    expect(body.split('\n').slice(0, 2)).toEqual([CI_HEAL_COMMENT_MARKER, `head: ${HEAD}`]);
    expect(countCiHealComments([{ body, author: AUTOMATION }])).toBe(1);
    expect(buildCiHealComment({ reason: 'red-ci' })).not.toMatch(/^head:/m); // no sha → no line, never `head: `
  });

  it('a budget-refused post writes an owed record carrying the head sha and returns commented:false', () => {
    const owed = [];
    const out = postOrOweCiHealComment({
      pr: 2821, body: 'b', headSha: HEAD, repo: REPO,
      post: () => { throw budgetError(); }, owe: (r) => { owed.push(r); return r; },
    });
    expect(out.commented).toBe(false);
    expect(owed).toEqual([{ repo: 'we', slug: 'chalbert/web-everything', pr: 2821, kind: 'ci-heal', headSha: HEAD, body: 'b' }]);
  });

  it('a NON-budget failure still throws (nothing owed) — a retry would not fix it', () => {
    const owe = () => { throw new Error('must not owe'); };
    expect(() => postOrOweCiHealComment({
      pr: 1, body: 'b', headSha: HEAD, repo: REPO, post: () => { throw new Error('HTTP 404: Not Found'); }, owe,
    })).toThrow(/404/);
  });

  it('with no head sha (no dedupe key) a budget refusal still throws rather than owing an undedupable write', () => {
    expect(() => postOrOweCiHealComment({
      pr: 1, body: 'b', headSha: '', repo: REPO, post: () => { throw budgetError(); }, owe: () => ({}),
    })).toThrow(/rate limit/);
  });

  it('resolveHealHead — --head wins; else local `git rev-parse HEAD`; else empty', () => {
    expect(resolveHealHead({ headFlag: HEAD, exec: () => { throw new Error('unused'); } })).toBe(HEAD);
    expect(resolveHealHead({ exec: () => `${HEAD}\n` })).toBe(HEAD);
    expect(resolveHealHead({ exec: () => { throw new Error('not a repo'); } })).toBe('');
  });

  it('REAL CLI PATH: a budget-blocked `gh` → owed record on disk (with head), exit 0, not a bare failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ci-heal-mark-owed-'));
    try {
      const bin = join(dir, 'bin');
      mkdirSync(bin, { recursive: true });
      // A `gh` that refuses exactly like gh-throttle's budget_blocked outcome does, for every call.
      writeFileSync(join(bin, 'gh'), `#!/bin/sh\nprintf '%s' ${JSON.stringify(budgetBlockedMessage({ resource: 'graphql', until: 'soon' }))} >&2\nexit 1\n`);
      chmodSync(join(bin, 'gh'), 0o755);
      const lockRoot = join(dir, 'lock');
      const r = spawnSync(process.execPath, [
        join(dirname(fileURLToPath(import.meta.url)), '..', 'ci-heal-mark.mjs'), '2821', '--repo=chalbert/web-everything', '--reason=red-ci', `--head=${HEAD}`,
      ], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WE_GH_THROTTLE_LOCK_ROOT: lockRoot } });
      expect(r.status, r.stderr).toBe(0);
      expect(JSON.parse(r.stdout.trim().split('\n').pop())).toMatchObject({ ok: true, pr: 2821, commented: false, owed: true });
      const owed = readOwedWrites({ dir: join(lockRoot, 'ci-heal-owed') });
      expect(owed).toEqual([expect.objectContaining({ repo: 'we', slug: 'chalbert/web-everything', pr: 2821, kind: 'ci-heal', headSha: HEAD })]);
      // The owed body IS the comment that will be posted — and it dedupes against itself once live.
      expect(owedWriteAlreadyLive([{ body: owed[0].body, author: AUTOMATION }], owed[0])).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
