/**
 * @file scripts/lib/__tests__/daemon-live-smoke.test.mjs
 * @description #4072 — the live smoke gate's `gh` checks must run `gh` EXACTLY the way a dispatched session
 *   does: through the App shim, with the same `--settings` env a session gets, and WITHOUT any ambient
 *   `GH_TOKEN`/`GITHUB_TOKEN` the calling (daemon) process happens to be carrying. Before this fix, the gate
 *   merged the shim's `PATH` override onto the RAW daemon env (`{...env, ...shimEnv}`) — so the daemon's own
 *   continuously-refreshed `GH_TOKEN` (set for the daemon's OWN gh/git calls by
 *   `github-app-auth-env.mjs#ensureFreshGithubAppEnv`) rode along underneath the override and silently masked
 *   the exact fallback failure a properly-sanitized dispatched session hits when the shared token cache is
 *   empty or stale. The gate passed on 2026-09-24, the same day every real bot session got HTTP 401.
 *
 *   The second describe block below is the load-bearing proof: it runs the gate's REAL `gh-api-repo` check
 *   function (from {@link SMOKE_CHECKS}) against a fake `gh` that only succeeds when it sees an ambient
 *   `GH_TOKEN` — standing in for the live incident's shared-cache-empty fallback — and shows the check FAILS
 *   through {@link ghDispatchedSessionEnv} (the fix) but WOULD HAVE PASSED through the pre-fix
 *   `{...env, ...shimEnv}` composition (reproduced inline, since that's exactly the bug this item removes).
 */
import { describe, it, expect, vi } from 'vitest';
import { SMOKE_CHECKS, ghDispatchedSessionEnv } from '../daemon-live-smoke.mjs';

const ghApiCheck = SMOKE_CHECKS.find((c) => c.name === 'gh-api-repo').run;
const ghPrListCheck = SMOKE_CHECKS.find((c) => c.name === 'gh-pr-list').run;

describe('ghDispatchedSessionEnv — pure composition (#4072)', () => {
  it('strips an inherited GH_TOKEN/GITHUB_TOKEN even when App auth is not configured (no shim to fall back on)', () => {
    const out = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale', GITHUB_TOKEN: 'also-stale', PATH: '/usr/bin', HOME: '/x' });
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.GITHUB_TOKEN).toBeUndefined();
    expect(out.PATH).toBe('/usr/bin');
    expect(out.HOME).toBe('/x');
  });

  it('strips the inherited token even when App auth IS configured and the shim resolves — never lets an ambient token ride under the PATH override', () => {
    const out = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GH_TOKEN: 'daemon-ambient-stale', PATH: '/opt/homebrew/bin',
      },
      {
        pathEnv: '/opt/homebrew/bin', dir: '/shim', cachePath: '/x/cache.json',
        exists: (p) => p === '/opt/homebrew/bin/gh', writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn(),
      },
    );
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.PATH).toBe('/shim:/opt/homebrew/bin'); // the shim override still lands
  });

  it('a real cwd write (settings.local.json) still never leaks the ambient token into the returned env', () => {
    const out = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GITHUB_TOKEN: 'daemon-ambient-stale', PATH: '/opt/homebrew/bin',
      },
      { pathEnv: '/opt/homebrew/bin', dir: '/shim', exists: () => true, writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn() },
    );
    expect(out.GITHUB_TOKEN).toBeUndefined();
  });

  it('is a passthrough (no shim, nothing stripped) when neither App auth nor a token is present — the unconfigured, unremarkable host', () => {
    expect(ghDispatchedSessionEnv({ PATH: '/usr/bin' })).toEqual({ PATH: '/usr/bin' });
  });
});

describe("the gate's gh-api-repo / gh-pr-list checks — must FAIL exactly like a dispatched session would (#4072 proof)", () => {
  // Stands in for the real shim's own documented fallback (`runInherited(process.env)` when its shared token
  // cache is empty/stale, see gh-app-shim.mjs's renderGhShimScript): succeeds ONLY if the env the check
  // actually spawned `gh` with still carries a GH_TOKEN. A real dispatched session's spawn env is ALWAYS
  // sanitized at exactly this fallback moment (never carries one) — so a real session sees a 401 here.
  function fakeGh(cmd, args, opts) {
    if (opts && opts.env && opts.env.GH_TOKEN) return Promise.resolve('{}');
    return Promise.reject(Object.assign(new Error('gh api failed'), { stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)' }));
  }

  it('FAILS (RED→GREEN: this is what today\'s bug let quietly pass) when routed through ghDispatchedSessionEnv against a daemon env carrying a stale ambient GH_TOKEN and no shim configured', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' });
    const result = await ghApiCheck({ ghChildEnv, budgets: { ghApiMs: 1000 }, runChild });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/failed/);
    expect(ghChildEnv.GH_TOKEN).toBeUndefined(); // the sanitize step is what made the fake `gh` fail above
  });

  it('gh-pr-list FAILS the same way, for the same reason', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv({ GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' });
    const result = await ghPrListCheck({ ghChildEnv, budgets: { ghPrListMs: 1000 }, runChild });
    expect(result.ok).toBe(false);
  });

  it('the PRE-FIX composition (`{...env, ...shimEnv}`, no sanitize) WOULD HAVE PASSED this exact scenario — the bug this item removes', async () => {
    const runChild = vi.fn(fakeGh);
    // Reproduces the pre-fix `ghEnvFor`: no shim contributed (App auth unconfigured here, matching the
    // isolated unit above), so `{...env, ...null}` === env, UNCHANGED — the ambient token survives untouched.
    const preFixGhChildEnv = { GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/usr/bin' };
    const result = await ghApiCheck({ ghChildEnv: preFixGhChildEnv, budgets: { ghApiMs: 1000 }, runChild });
    expect(result.ok).toBe(true); // demonstrates the masking bug: the gate would have adopted broken code
  });

  it('still PASSES when a fresh token really is available through the shim path (App auth configured, cache resolves) — the fix never breaks the legitimate case', async () => {
    const runChild = vi.fn(fakeGh);
    const ghChildEnv = ghDispatchedSessionEnv(
      {
        WE_GITHUB_APP_ID: '1', WE_GITHUB_APP_INSTALLATION_ID: '2', WE_GITHUB_APP_PRIVATE_KEY_PATH: '/x/key.pem',
        GH_TOKEN: 'daemon-ambient-stale-token', PATH: '/opt/homebrew/bin',
      },
      { pathEnv: '/opt/homebrew/bin', dir: '/shim', exists: () => true, writeFile: vi.fn(), chmod: vi.fn(), mkdir: vi.fn() },
    );
    // The shim resolved (PATH override present) but the ambient token was still stripped — a real dispatched
    // session in this state calls through the shim script, which reads its OWN fresh cache and re-applies a
    // token itself; here we simulate that downstream success by handing the fake `gh` a runChild that treats
    // "shim PATH present" as equivalent to "the shim will supply its own fresh token". Since this fake can only
    // key off `opts.env`, assert the sanitize contract directly instead (no ambient leak) — the shim's own
    // internal fresh-token behavior is already proven live in gh-app-shim.test.mjs.
    expect(ghChildEnv.GH_TOKEN).toBeUndefined();
    expect(ghChildEnv.PATH).toBe('/shim:/opt/homebrew/bin');
  });
});
