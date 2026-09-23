/**
 * @file scripts/lib/__tests__/github-app-auth-env.test.mjs
 * @description Unit proof of the #3866-ratified GitHub App auth-env wiring. Every effect (the cache
 *   read/write, the mint call, the repo listing, the clock, the `process.env` mutation) is injected — no real fs,
 *   no real network, no real GitHub App needed.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveGithubAppEnvConfig, isCacheFresh, ensureFreshGithubAppEnv, withGithubAppAuth,
  REFRESH_BUFFER_MS, defaultCachePath, findInstallationGaps, CACHE_VERSION, REQUIRED_APP_PERMISSIONS, REQUIRED_APP_REPOS,
} from '../github-app-auth-env.mjs';

const CONFIGURED_ENV = {
  WE_GITHUB_APP_ID: '5037855',
  WE_GITHUB_APP_INSTALLATION_ID: '163880042',
  WE_GITHUB_APP_PRIVATE_KEY_PATH: '/Users/x/.secrets/github-apps/web-everything.pem',
};

/** A fully-configured installation: every required permission at its required level, every repo visible. */
const FULL_PERMS = { ...REQUIRED_APP_PERMISSIONS };
const allRepos = vi.fn(async () => [...REQUIRED_APP_REPOS]);

describe('resolveGithubAppEnvConfig — opt-in, all three or none', () => {
  it('returns the config when all three env vars are set', () => {
    expect(resolveGithubAppEnvConfig(CONFIGURED_ENV)).toEqual({
      appId: '5037855', installationId: '163880042', privateKeyPath: '/Users/x/.secrets/github-apps/web-everything.pem',
    });
  });

  it('returns null when none are set — the status-quo, personal-auth path, unchanged', () => {
    expect(resolveGithubAppEnvConfig({})).toBeNull();
  });

  it('returns null on a PARTIAL configuration — a two-thirds opt-in is almost certainly a typo, never a real intent', () => {
    expect(resolveGithubAppEnvConfig({ WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2' })).toBeNull();
    expect(resolveGithubAppEnvConfig({ WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x.pem' })).toBeNull();
  });
});

describe('isCacheFresh — pure freshness classifier', () => {
  const NOW = Date.parse('2026-09-23T12:00:00Z');

  it('a token expiring well in the future is fresh', () => {
    expect(isCacheFresh({ v: CACHE_VERSION, expiresAt: '2026-09-23T13:00:00Z' }, NOW)).toBe(true);
  });

  it('a token expiring within the refresh buffer is NOT fresh — refresh early, never right at the wire', () => {
    const expiresAt = new Date(NOW + REFRESH_BUFFER_MS - 1000).toISOString();
    expect(isCacheFresh({ v: CACHE_VERSION, expiresAt }, NOW)).toBe(false);
  });

  it('a token already past its own expiry is not fresh', () => {
    expect(isCacheFresh({ v: CACHE_VERSION, expiresAt: '2026-09-23T11:00:00Z' }, NOW)).toBe(false);
  });

  it('no cache at all (null) is never fresh — that is a mint, not a refresh', () => {
    expect(isCacheFresh(null, NOW)).toBe(false);
  });

  it('a corrupt/malformed cache entry (no usable expiresAt) is not fresh', () => {
    expect(isCacheFresh({}, NOW)).toBe(false);
    expect(isCacheFresh({ v: CACHE_VERSION, expiresAt: 'not-a-date' }, NOW)).toBe(false);
  });

  it('an entry from another cache version (or none) is never fresh, however far off its expiry', () => {
    expect(isCacheFresh({ expiresAt: '2026-09-23T13:00:00Z' }, NOW)).toBe(false);
    expect(isCacheFresh({ v: CACHE_VERSION - 1, expiresAt: '2026-09-23T13:00:00Z' }, NOW)).toBe(false);
  });
});

describe('THE DEPLOY INCIDENT (2026-09-23) — an unvalidated token cached by an older version', () => {
  it('is never applied: it is re-minted and re-checked, and a still-under-configured App is refused', async () => {
    const oldEntry = { token: 'ghs_unvalidated', expiresAt: '2026-09-23T13:58:13Z' }; // no `v` — the pre-check shape
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_new', expiresAt: '2026-09-23T14:00:00Z', permissions: {} });
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: Date.parse('2026-09-23T13:20:00Z'), readCache: () => oldEntry, writeCache: vi.fn(),
      mint, listRepos: vi.fn(async () => []), setEnv, log: { error: vi.fn() },
    });
    expect(mint).toHaveBeenCalled();
    expect(result.reason).toBe('insufficient-access');
    expect(setEnv).not.toHaveBeenCalled(); // neither the old token nor the fresh one
  });
});

describe('ensureFreshGithubAppEnv — the IO shell, every effect injected', () => {
  const NOW = Date.parse('2026-09-23T12:00:00Z');

  it('not configured — does nothing, mints nothing, sets no env, and says so', async () => {
    const mint = vi.fn();
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({ env: {}, now: NOW, mint, setEnv });
    expect(result).toEqual({ applied: false, reason: 'not-configured' });
    expect(mint).not.toHaveBeenCalled();
    expect(setEnv).not.toHaveBeenCalled();
  });

  it('cache already fresh — reads it, mints NOTHING, and sets env from the cached token', async () => {
    const cached = { v: CACHE_VERSION, token: 'ghs_cached', expiresAt: '2026-09-23T13:00:00Z' };
    const readCache = vi.fn(() => cached);
    const writeCache = vi.fn();
    const mint = vi.fn();
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: NOW, readCache, writeCache, mint, setEnv,
    });
    expect(result).toEqual({ applied: true, reason: 'ok' });
    expect(mint).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
    expect(setEnv).toHaveBeenCalledWith('ghs_cached');
  });

  it('cache missing — mints a fresh token, writes it back to the cache, and sets env from it', async () => {
    const readCache = vi.fn(() => null);
    const writeCache = vi.fn();
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_fresh', expiresAt: '2026-09-23T13:00:00Z', permissions: FULL_PERMS });
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: NOW, readCache, writeCache, mint, listRepos: allRepos, setEnv,
    });
    expect(result).toEqual({ applied: true, reason: 'ok' });
    expect(mint).toHaveBeenCalledWith({
      appId: '5037855', installationId: '163880042',
      privateKeyPath: '/Users/x/.secrets/github-apps/web-everything.pem', now: NOW,
    });
    expect(writeCache).toHaveBeenCalledWith(expect.any(String), { v: CACHE_VERSION, token: 'ghs_fresh', expiresAt: '2026-09-23T13:00:00Z' });
    expect(setEnv).toHaveBeenCalledWith('ghs_fresh');
  });

  it('cache expiring within the buffer — mints a fresh one rather than trusting the stale entry', async () => {
    const expiresAt = new Date(NOW + REFRESH_BUFFER_MS - 1000).toISOString();
    const readCache = vi.fn(() => ({ v: CACHE_VERSION, token: 'ghs_stale', expiresAt }));
    const writeCache = vi.fn();
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_new', expiresAt: '2026-09-23T14:00:00Z', permissions: FULL_PERMS });
    const setEnv = vi.fn();
    await ensureFreshGithubAppEnv({ env: CONFIGURED_ENV, now: NOW, readCache, writeCache, mint, listRepos: allRepos, setEnv });
    expect(mint).toHaveBeenCalled();
    expect(setEnv).toHaveBeenCalledWith('ghs_new');
  });

  it('a mint failure NEVER throws — falls back, leaves env untouched, and reports why', async () => {
    const readCache = vi.fn(() => null);
    const mint = vi.fn().mockRejectedValue(new Error('github-app-token: mint failed (HTTP 401): bad credentials'));
    const setEnv = vi.fn();
    const log = { error: vi.fn() };
    const result = await ensureFreshGithubAppEnv({ env: CONFIGURED_ENV, now: NOW, readCache, mint, setEnv, log });
    expect(result).toEqual({ applied: false, reason: 'mint-failed' });
    expect(setEnv).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('mint failed'));
  });

  it('a corrupt cache (unreadable JSON, surfaced as null by the reader) is treated as absent, not thrown on', async () => {
    const readCache = vi.fn(() => null); // the real readCacheFile swallows a parse error into null — this
    // pins the CONTRACT ensureFreshGithubAppEnv relies on, not the real fs-backed reader (that would need a
    // real corrupt file on disk, out of scope for a pure-injection unit test).
    const writeCache = vi.fn();
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_recovered', expiresAt: '2026-09-23T13:00:00Z', permissions: FULL_PERMS });
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({ env: CONFIGURED_ENV, now: NOW, readCache, writeCache, mint, listRepos: allRepos, setEnv });
    expect(result.applied).toBe(true);
    expect(setEnv).toHaveBeenCalledWith('ghs_recovered');
  });

  // Live-caught 2026-09-23: the real first installation minted fine with `permissions: {}` and only public-repo
  // read access. Applying it would have left the fleet unable to label, comment, merge, or see plateau-app.
  it('THE LIVE CASE: an installation with NO permissions is refused — personal auth stays, nothing cached', async () => {
    const writeCache = vi.fn();
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_bare', expiresAt: '2026-09-23T13:00:00Z', permissions: {} });
    const listRepos = vi.fn(async () => ['chalbert/web-everything']);
    const setEnv = vi.fn();
    const log = { error: vi.fn() };
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: NOW, readCache: () => null, writeCache, mint, listRepos, setEnv, log,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('insufficient-access');
    expect(result.missingPermissions).toContain('pull_requests:write');
    expect(result.missingRepos).toEqual(REQUIRED_APP_REPOS.filter((r) => r !== 'chalbert/web-everything'));
    expect(setEnv).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled(); // an unusable token is never cached, so the next refresh re-checks
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('NOT applying'));
  });

  it('full permissions but a repo missing from the installation is still refused', async () => {
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_x', expiresAt: '2026-09-23T13:00:00Z', permissions: FULL_PERMS });
    const listRepos = vi.fn(async () => REQUIRED_APP_REPOS.slice(0, 1));
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: NOW, readCache: () => null, writeCache: vi.fn(), mint, listRepos, setEnv, log: { error: vi.fn() },
    });
    expect(result.reason).toBe('insufficient-access');
    expect(result.missingPermissions).toEqual([]);
    expect(setEnv).not.toHaveBeenCalled();
  });

  it('a failure LISTING repos is treated like a mint failure — never applied, never thrown', async () => {
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_x', expiresAt: '2026-09-23T13:00:00Z', permissions: FULL_PERMS });
    const listRepos = vi.fn(async () => { throw new Error('HTTP 502'); });
    const setEnv = vi.fn();
    const result = await ensureFreshGithubAppEnv({
      env: CONFIGURED_ENV, now: NOW, readCache: () => null, writeCache: vi.fn(), mint, listRepos, setEnv, log: { error: vi.fn() },
    });
    expect(result).toEqual({ applied: false, reason: 'mint-failed' });
    expect(setEnv).not.toHaveBeenCalled();
  });
});

describe('findInstallationGaps — pure', () => {
  it('a fully-configured installation has no gaps', () => {
    expect(findInstallationGaps({ permissions: FULL_PERMS, repos: [...REQUIRED_APP_REPOS] })).toEqual({ missingPermissions: [], missingRepos: [] });
  });

  it('a higher level satisfies a lower requirement (write covers read, admin covers write)', () => {
    const perms = { ...FULL_PERMS, checks: 'write', contents: 'admin' };
    expect(findInstallationGaps({ permissions: perms, repos: [...REQUIRED_APP_REPOS] }).missingPermissions).toEqual([]);
  });

  it('a lower level than required is a gap (read where write is needed)', () => {
    const perms = { ...FULL_PERMS, pull_requests: 'read' };
    expect(findInstallationGaps({ permissions: perms, repos: [...REQUIRED_APP_REPOS] }).missingPermissions).toEqual(['pull_requests:write']);
  });

  it('repo matching is case-insensitive (GitHub full names are)', () => {
    const repos = REQUIRED_APP_REPOS.map((r) => r.toUpperCase());
    expect(findInstallationGaps({ permissions: FULL_PERMS, repos }).missingRepos).toEqual([]);
  });
});

describe('withGithubAppAuth — refresh at the top of every tick, never on a timer', () => {
  // Live-caught 2026-09-23: a timer refresh could not run while a daemon tick's blocking execFileSync calls
  // held the event loop, and a mint caught mid-connection timed out. Per-tick ordering is the fix.
  it('the token is set BEFORE the real tick runs — including the very first tick', async () => {
    const order = [];
    const setEnv = vi.fn(() => order.push('setEnv'));
    const mint = vi.fn().mockResolvedValue({ token: 'ghs_t', expiresAt: '2099-01-01T00:00:00Z', permissions: FULL_PERMS });
    const effects = { tickOnce: vi.fn(() => { order.push('tick'); return { ok: 1 }; }), sleep: vi.fn(), intervalMs: 5 };
    const wrapped = withGithubAppAuth(effects, {
      env: CONFIGURED_ENV, readCache: () => null, writeCache: vi.fn(), mint, listRepos: allRepos, setEnv,
    });
    const result = await wrapped.tickOnce();
    expect(order).toEqual(['setEnv', 'tick']);
    expect(result).toEqual({ ok: 1 }); // the real tick's own result passes through untouched
  });

  it('keeps every other effect as-is (sleep, heartbeat, interval) — only tickOnce is wrapped', () => {
    const effects = { tickOnce: () => {}, sleep: vi.fn(), heartbeat: vi.fn(), intervalMs: 123 };
    const wrapped = withGithubAppAuth(effects, { env: {} });
    expect(wrapped.sleep).toBe(effects.sleep);
    expect(wrapped.heartbeat).toBe(effects.heartbeat);
    expect(wrapped.intervalMs).toBe(123);
    expect(wrapped.tickOnce).not.toBe(effects.tickOnce);
  });

  it('a failed refresh never blocks the tick — it still runs, on whatever auth was already in effect', async () => {
    const tick = vi.fn(() => 'ran');
    const mint = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const wrapped = withGithubAppAuth({ tickOnce: tick }, {
      env: CONFIGURED_ENV, readCache: () => null, mint, listRepos: allRepos, setEnv: vi.fn(), log: { error: vi.fn() },
    });
    await expect(wrapped.tickOnce()).resolves.toBe('ran');
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('not configured — the tick runs with no refresh attempt at all', async () => {
    const mint = vi.fn();
    const tick = vi.fn(() => 'ran');
    const wrapped = withGithubAppAuth({ tickOnce: tick }, { env: {}, mint });
    await expect(wrapped.tickOnce()).resolves.toBe('ran');
    expect(mint).not.toHaveBeenCalled();
  });
});

describe('defaultCachePath — one shared cache, keyed by home dir only, never per-process', () => {
  it('is deterministic for a given home dir, so two independent daemons resolve the SAME file', () => {
    expect(defaultCachePath('/Users/op')).toBe(defaultCachePath('/Users/op'));
    expect(defaultCachePath('/Users/op')).toContain('/Users/op/.claude/github-app-token/');
  });
});
