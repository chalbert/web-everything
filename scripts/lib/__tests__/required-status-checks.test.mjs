/**
 * @file required-status-checks.test.mjs — unit tests for `we:scripts/lib/required-status-checks.mjs` (#2748
 * false-red follow-up, soak-replay-gate PR #2775). Covers the full degradation chain the module's own header
 * documents: live fetch → cache write → cache hit within TTL → live failure falls back to a stale cache →
 * live failure with no cache at all falls back to the hardcoded {@link FALLBACK_REQUIRED_STATUS_CHECKS}. The
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
    expect(cached.checks).toEqual(['test', 'smoke', 'daemon-soak']);
    expect(cached.key).toBe('chalbert/web-everything@main');
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
