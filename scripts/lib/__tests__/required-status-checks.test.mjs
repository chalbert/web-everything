/**
 * @file required-status-checks.test.mjs — unit tests for `we:scripts/lib/required-status-checks.mjs` (#2748
 * false-red follow-up, soak-replay-gate PR #2775). Covers the full degradation chain the module's own header
 * documents: live fetch → cache write → cache hit within TTL → live failure falls back to a stale cache →
 * live failure with no cache uses only the repo's declared set, or reports unavailable. The
 * `gh` reader is injected throughout, so every branch is reachable with no network and no credential.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  const execFileSync = vi.fn(() => '["test","smoke","daemon-soak"]');
  return { ...actual, execFileSync, default: { ...actual.default, execFileSync } };
});
import { execFileSync } from 'node:child_process';
import { getRequiredStatusChecks, defaultReadRequiredStatusChecks, FALLBACK_REQUIRED_STATUS_CHECKS } from '../required-status-checks.mjs';

describe('getRequiredStatusChecks', () => {
  let dir;
  let cachePath;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'we-required-status-checks-'));
    cachePath = join(dir, '.required-status-checks-cache.json');
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('fetches live and writes a cache on success', () => {
    const readChecks = () => ['test', 'smoke', 'daemon-soak'];
    const result = getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1000, readChecks });
    expect(result).toEqual({ checks: ['test', 'smoke', 'daemon-soak'], source: 'live' });
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    expect(cached.entries['chalbert/web-everything@main']).toEqual({
      checks: ['test', 'smoke', 'daemon-soak'], source: 'live', fetchedAtMs: 1000,
    });
  });

  it('serves the cache within the TTL without calling the reader again', () => {
    let calls = 0;
    const readChecks = () => { calls += 1; return ['test', 'smoke', 'daemon-soak']; };
    getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1000, readChecks });
    const second = getRequiredStatusChecks({
      repo: 'chalbert/web-everything', cachePath, now: 1000 + 60_000, ttlMs: 15 * 60_000, readChecks,
    });
    expect(second).toEqual({ checks: ['test', 'smoke', 'daemon-soak'], source: 'cache' });
    expect(calls).toBe(1);
  });

  it('re-fetches once the cache is past its TTL', () => {
    let calls = 0;
    const readChecks = () => { calls += 1; return ['test', 'smoke', 'daemon-soak', 'a-new-required-check']; };
    getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1000, ttlMs: 1000, readChecks });
    const third = getRequiredStatusChecks({
      repo: 'chalbert/web-everything', cachePath, now: 1000 + 2000, ttlMs: 1000, readChecks,
    });
    expect(third).toEqual({ checks: ['test', 'smoke', 'daemon-soak', 'a-new-required-check'], source: 'live' });
    expect(calls).toBe(2);
  });

  it('falls back to a STALE cache when the live fetch fails', () => {
    const flakyRead = () => { throw new Error('gh: rate limited'); };
    writeFileSync(cachePath, JSON.stringify({
      key: 'chalbert/web-everything@main', checks: ['test', 'smoke', 'daemon-soak'], fetchedAtMs: 0,
    }));
    const result = getRequiredStatusChecks({
      repo: 'chalbert/web-everything', cachePath, now: 999_999_999, ttlMs: 1000, readChecks: flakyRead,
    });
    expect(result).toEqual({ checks: ['test', 'smoke', 'daemon-soak'], source: 'stale-cache' });
  });

  it('falls back to the hardcoded FALLBACK_REQUIRED_STATUS_CHECKS when there is no cache at all and the ' +
    'live fetch fails — gh missing, unauthenticated, offline, or rate-limited', () => {
    const flakyRead = () => { throw new Error('gh: command not found'); };
    const result = getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1000, readChecks: flakyRead });
    expect(result).toEqual({ checks: [...FALLBACK_REQUIRED_STATUS_CHECKS], source: 'fallback' });
  });

  it('does not use a live result that comes back empty — falls through to cache/fallback instead', () => {
    const readChecks = () => [];
    const result = getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1000, readChecks });
    expect(result).toEqual({ checks: [...FALLBACK_REQUIRED_STATUS_CHECKS], source: 'fallback' });
  });

  it('keys the cache by repo+branch — a different repo/branch never reads another\'s cached set', () => {
    const readChecks = () => ['test', 'smoke', 'daemon-soak'];
    getRequiredStatusChecks({ repo: 'chalbert/web-everything', branch: 'main', cachePath, now: 1000, readChecks });
    let otherCalls = 0;
    const otherRead = () => { otherCalls += 1; return ['test']; };
    const result = getRequiredStatusChecks({ repo: 'chalbert/other-repo', branch: 'main', cachePath, now: 1000, readChecks: otherRead });
    expect(result).toEqual({ checks: ['test'], source: 'live' });
    expect(otherCalls).toBe(1);
  });

  const plan403 = () => { throw Object.assign(new Error('gh api failed'), {
    stderr: Buffer.from('gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)'),
  }); };

  it.each([
    ['chalbert/plateau-app', ['test', 'e2e']],
    ['chalbert/frontierui', ['test']],
    ['chalbert/web-everything', ['test', 'smoke', 'daemon-soak']],
  ])('caches the declared set for %s on a plan-feature 403, then retries after TTL', (repo, checks) => {
    const readChecks = vi.fn(plan403);
    expect(getRequiredStatusChecks({ repo, cachePath, now: 1000, ttlMs: 1000, readChecks }))
      .toEqual({ checks, source: 'declared' });
    expect(getRequiredStatusChecks({ repo, cachePath, now: 1500, ttlMs: 1000, readChecks }))
      .toEqual({ checks, source: 'declared' });
    expect(readChecks).toHaveBeenCalledTimes(1);
    readChecks.mockReturnValue(['new-protection-check']);
    expect(getRequiredStatusChecks({ repo, cachePath, now: 2000, ttlMs: 1000, readChecks }))
      .toEqual({ checks: ['new-protection-check'], source: 'live' });
    expect(readChecks).toHaveBeenCalledTimes(2);
  });

  it('does not cache unrelated 403s as a plan restriction', () => {
    const readChecks = vi.fn(() => { throw new Error('HTTP 403: API rate limit exceeded'); });
    for (let now = 1000; now <= 1001; now++) {
      expect(getRequiredStatusChecks({ repo: 'chalbert/plateau-app', cachePath, now, readChecks }))
        .toEqual({ checks: ['test', 'e2e'], source: 'fallback' });
    }
    expect(readChecks).toHaveBeenCalledTimes(2);
  });

  it.each(['chalbert/unknown', undefined])('returns unavailable for undeclared repo %s, never WE defaults', repo => {
    expect(getRequiredStatusChecks({ repo, cachePath, readChecks: plan403 }))
      .toEqual({ checks: [], source: 'unavailable' });
    expect(getRequiredStatusChecks({ repo, cachePath, readChecks: () => { throw new Error('offline'); } }))
      .toEqual({ checks: [], source: 'unavailable' });
  });

  it('alternates repositories and branches without evicting live or declared entries', () => {
    const liveRead = vi.fn(() => ['test', 'smoke', 'daemon-soak', 'new-check']);
    const declaredRead = vi.fn(plan403);
    const releaseRead = vi.fn(() => ['release-check']);
    for (const now of [1000, 1500]) {
      expect(getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now, readChecks: liveRead }))
        .toEqual({ checks: ['test', 'smoke', 'daemon-soak', 'new-check'], source: now === 1000 ? 'live' : 'cache' });
      expect(getRequiredStatusChecks({ repo: 'chalbert/plateau-app', cachePath, now, readChecks: declaredRead }))
        .toEqual({ checks: ['test', 'e2e'], source: 'declared' });
      expect(getRequiredStatusChecks({ repo: 'chalbert/web-everything', branch: 'release', cachePath, now, readChecks: releaseRead }))
        .toEqual({ checks: ['release-check'], source: now === 1000 ? 'live' : 'cache' });
    }
    for (const reader of [liveRead, declaredRead, releaseRead]) expect(reader).toHaveBeenCalledTimes(1);
    expect(Object.keys(JSON.parse(readFileSync(cachePath, 'utf8')).entries)).toHaveLength(3);
  });

  it('preserves a legacy entry when another repo writes its first cache entry', () => {
    writeFileSync(cachePath, JSON.stringify({
      key: 'chalbert/web-everything@main', checks: ['test', 'legacy-required'], fetchedAtMs: 1000,
    }));
    getRequiredStatusChecks({ repo: 'chalbert/plateau-app', cachePath, now: 1500, readChecks: plan403 });
    const readChecks = vi.fn();
    expect(getRequiredStatusChecks({ repo: 'chalbert/web-everything', cachePath, now: 1500, readChecks }))
      .toEqual({ checks: ['test', 'legacy-required'], source: 'cache' });
    expect(readChecks).not.toHaveBeenCalled();
  });
});

describe('defaultReadRequiredStatusChecks', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('shells `gh api repos/<repo>/branches/<branch>/protection --jq .required_status_checks.contexts`', () => {
    const result = defaultReadRequiredStatusChecks({ repo: 'chalbert/web-everything', branch: 'main' });
    expect(result).toEqual(['test', 'smoke', 'daemon-soak']);
    expect(execFileSync).toHaveBeenCalledWith(
      'gh',
      ['api', 'repos/chalbert/web-everything/branches/main/protection', '--jq', '.required_status_checks.contexts'],
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });

  // `repo` omitted lets `gh api` resolve `{owner}/{repo}` from the current directory's git remote — the same
  // "let gh infer it" convention `we:scripts/conveyor/reconcile-pass.mjs#defaultReadAheadBy` already uses,
  // rather than this reader failing a caller (e.g. a local CLI run with no `--repo` flag) that never had a
  // slug to pass.
  it('falls back to gh\'s own {owner}/{repo} template placeholders when no repo slug is given', () => {
    defaultReadRequiredStatusChecks({});
    expect(execFileSync).toHaveBeenCalledWith(
      'gh',
      ['api', 'repos/{owner}/{repo}/branches/main/protection', '--jq', '.required_status_checks.contexts'],
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });
});
