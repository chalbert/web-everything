/**
 * @file scripts/lib/__tests__/gh-app-shim.test.mjs
 * @description Unit + live proof of #x8mpubm's real fix: a dispatched `claude --bg` session does not inherit
 *   its spawner's ambient env, so getting a fresh App token into one needs a PATH-shadowing `gh` wrapper that
 *   reads the shared token cache on every call, plumbed in via `--settings`. Every pure function here is
 *   tested with no real fs/network; {@link ensureGhShim}/{@link buildGhShimSettingsEnv} additionally get a
 *   REAL tmpdir round trip, and the rendered shim script is REALLY EXECUTED (as `dispatch-spawn-live.test.mjs`
 *   does for the CLI argv) against a fake "real gh" — the one thing a purely-textual assertion on
 *   {@link renderGhShimScript}'s output could not prove.
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultShimDir, shimGhPath, resolveRealGhBinary, renderGhShimScript, ensureGhShim, ghShimPathOverride,
  buildGhShimSettingsEnv, looksLikeAppTokenAuthFailure,
} from '../gh-app-shim.mjs';

const CONFIGURED_ENV = {
  WE_GITHUB_APP_ID: '5037855',
  WE_GITHUB_APP_INSTALLATION_ID: '163880042',
  WE_GITHUB_APP_PRIVATE_KEY_PATH: '/Users/x/.secrets/github-apps/web-everything.pem',
};

describe('defaultShimDir / shimGhPath — deterministic, always named literally `gh`', () => {
  it('is deterministic for a given home dir', () => {
    expect(defaultShimDir('/Users/op')).toBe(defaultShimDir('/Users/op'));
    expect(defaultShimDir('/Users/op')).toContain('/Users/op/.claude/github-app-token/');
  });

  it('shimGhPath always ends in a bare `gh`, never an extension', () => {
    expect(shimGhPath('/tmp/shim')).toBe('/tmp/shim/gh');
  });
});

describe('resolveRealGhBinary — pure, given exists', () => {
  it('finds the first PATH entry (other than the shim dir itself) with a `gh` file', () => {
    const exists = (p) => p === '/opt/homebrew/bin/gh';
    expect(resolveRealGhBinary({ pathEnv: '/shim:/usr/bin:/opt/homebrew/bin', shimDir: '/shim', exists })).toBe('/opt/homebrew/bin/gh');
  });

  it('NEVER resolves to the shim dir itself, even if a stale `gh` sits there', () => {
    const exists = (p) => p === '/shim/gh' || p === '/opt/homebrew/bin/gh';
    expect(resolveRealGhBinary({ pathEnv: '/shim:/opt/homebrew/bin', shimDir: '/shim', exists })).toBe('/opt/homebrew/bin/gh');
  });

  it('returns null when no PATH entry has a real gh — the caller\'s signal to skip shimming entirely', () => {
    expect(resolveRealGhBinary({ pathEnv: '/usr/bin:/bin', shimDir: '/shim', exists: () => false })).toBeNull();
  });

  it('handles an empty PATH without throwing', () => {
    expect(resolveRealGhBinary({ pathEnv: '', shimDir: '/shim', exists: () => false })).toBeNull();
  });
});

describe('ghShimPathOverride — pure', () => {
  it('prepends the shim dir ahead of whatever PATH already held', () => {
    expect(ghShimPathOverride({ dir: '/shim', currentPath: '/usr/bin:/bin' })).toBe('/shim:/usr/bin:/bin');
  });
});

describe('looksLikeAppTokenAuthFailure — pure, distinguishes a rejected credential from every other gh failure', () => {
  it('recognizes the exact live-caught signature (review-2582)', () => {
    expect(looksLikeAppTokenAuthFailure('HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with:  gh auth login -h github.com')).toBe(true);
  });

  it('recognizes "Bad credentials" case-insensitively even without the HTTP 401 line', () => {
    expect(looksLikeAppTokenAuthFailure('bad credentials')).toBe(true);
  });

  it('does NOT match an unrelated failure — a missing PR, a bad flag, a network error', () => {
    expect(looksLikeAppTokenAuthFailure('HTTP 404: Not Found')).toBe(false);
    expect(looksLikeAppTokenAuthFailure('unknown flag --bogus')).toBe(false);
    expect(looksLikeAppTokenAuthFailure('dial tcp: connection refused')).toBe(false);
  });

  it('handles empty/undefined input without throwing', () => {
    expect(looksLikeAppTokenAuthFailure('')).toBe(false);
    expect(looksLikeAppTokenAuthFailure(undefined)).toBe(false);
  });
});

describe('renderGhShimScript — pure text, and REALLY RUN against a fake real gh', () => {
  it('bakes the real gh path and cache path in as literal, unambiguous JSON string constants', () => {
    const src = renderGhShimScript({ realGhPath: '/opt/homebrew/bin/gh', cachePath: '/home/op/.claude/github-app-token/web-everything.json' });
    expect(src).toContain(`const REAL_GH = ${JSON.stringify('/opt/homebrew/bin/gh')};`);
    expect(src).toContain(`const CACHE_PATH = ${JSON.stringify('/home/op/.claude/github-app-token/web-everything.json')};`);
    expect(src).toMatch(/^#!\/usr\/bin\/env node/);
  });

  // THE LIVE PROOF (mirrors dispatch-spawn-live.test.mjs's own reasoning: a textual assertion on the rendered
  // source could not catch a real runtime bug — a typo in the freshness check, a broken argv passthrough, a
  // wrong exit code). This actually renders, writes, chmods and EXECUTES the shim as a real child process.
  describe('live', () => {
    function setup() {
      const dir = mkdtempSync(join(tmpdir(), 'we-gh-shim-live-'));
      const realGh = join(dir, 'real-gh');
      // The fake "real gh": echoes its own argv and whatever GH_TOKEN it saw, so the test can assert both.
      writeFileSync(realGh, '#!/usr/bin/env node\nconsole.log(JSON.stringify({ argv: process.argv.slice(2), ghToken: process.env.GH_TOKEN || null }));\n', 'utf8');
      chmodSync(realGh, 0o755);
      const cachePath = join(dir, 'cache.json');
      const shimPath = join(dir, 'gh');
      writeFileSync(shimPath, renderGhShimScript({ realGhPath: realGh, cachePath }), 'utf8');
      chmodSync(shimPath, 0o755);
      return { dir, realGh, cachePath, shimPath };
    }

    it('a FRESH cached token is applied as GH_TOKEN for the real gh call', () => {
      const { dir, cachePath, shimPath } = setup();
      try {
        writeFileSync(cachePath, JSON.stringify({ v: 2, token: 'ghs_live_fresh', expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }), 'utf8');
        const out = JSON.parse(execFileSync(shimPath, ['pr', 'view', '181'], { encoding: 'utf8' }));
        expect(out.ghToken).toBe('ghs_live_fresh');
        expect(out.argv).toEqual(['pr', 'view', '181']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('a token within the refresh buffer of expiry is NOT applied — falls through to whatever auth was already in effect', () => {
      const { dir, cachePath, shimPath } = setup();
      try {
        writeFileSync(cachePath, JSON.stringify({ v: 2, token: 'ghs_live_stale', expiresAt: new Date(Date.now() + 60 * 1000).toISOString() }), 'utf8');
        const out = JSON.parse(execFileSync(shimPath, ['pr', 'view', '181'], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: undefined } }));
        expect(out.ghToken).toBeFalsy();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('a missing cache file is treated as absent, never thrown on — the real gh still runs', () => {
      const { dir, shimPath } = setup(); // cache.json is never written
      try {
        const out = JSON.parse(execFileSync(shimPath, ['--version'], { encoding: 'utf8' }));
        expect(out.ghToken).toBeFalsy();
        expect(out.argv).toEqual(['--version']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('a token that IS fresh by expiresAt but GitHub rejects (HTTP 401) falls back to personal auth instead of failing the session, and invalidates the shared cache (#xkse05k, live-caught review-2582)', () => {
      const { dir, cachePath, shimPath } = setup();
      const realGh = join(dir, 'real-gh');
      // Rejects the App token specifically (exactly what GitHub did to review-2582's "fresh" cached token);
      // succeeds when called with no GH_TOKEN at all (personal auth, proven healthy in the live incident).
      writeFileSync(
        realGh,
        '#!/usr/bin/env node\n'
          + 'if (process.env.GH_TOKEN) { process.stderr.write("HTTP 401: Bad credentials (https://api.github.com/graphql)\\n"); process.exit(1); }\n'
          + 'console.log(JSON.stringify({ ghToken: process.env.GH_TOKEN || null, ok: true }));\n',
        'utf8',
      );
      chmodSync(realGh, 0o755);
      writeFileSync(shimPath, renderGhShimScript({ realGhPath: realGh, cachePath }), 'utf8');
      chmodSync(shimPath, 0o755);
      try {
        writeFileSync(cachePath, JSON.stringify({ v: 2, token: 'ghs_rejected_but_fresh', expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString() }), 'utf8');
        const out = JSON.parse(execFileSync(shimPath, ['pr', 'view', '2582'], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: undefined } }));
        expect(out.ok).toBe(true);
        expect(out.ghToken).toBeFalsy(); // the retry ran with no token override — personal auth, not the rejected one
        expect(existsSync(cachePath)).toBe(false); // invalidated so the fleet's next refresh mints a replacement
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('a REAL gh failure unrelated to auth (e.g. a genuinely missing PR) is passed through untouched — never retried, cache left alone', () => {
      const { dir, cachePath, shimPath } = setup();
      const realGh = join(dir, 'real-gh');
      writeFileSync(
        realGh,
        '#!/usr/bin/env node\nprocess.stderr.write("HTTP 404: Not Found (https://api.github.com/graphql)\\n"); process.exit(1);\n',
      );
      chmodSync(realGh, 0o755);
      writeFileSync(shimPath, renderGhShimScript({ realGhPath: realGh, cachePath }), 'utf8');
      chmodSync(shimPath, 0o755);
      try {
        writeFileSync(cachePath, JSON.stringify({ v: 2, token: 'ghs_still_good', expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString() }), 'utf8');
        expect(() => execFileSync(shimPath, ['pr', 'view', '9999'], { encoding: 'utf8' })).toThrow(/status 1|Command failed/);
        expect(existsSync(cachePath)).toBe(true); // never touched — this wasn't a credential rejection
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('a rejected token with NO working fallback either still exits cleanly with the fallback\'s own code (no crash, no double-throw)', () => {
      const { dir, cachePath, shimPath } = setup();
      const realGh = join(dir, 'real-gh');
      // Fails every time, auth-shaped or not — proves the retry's OWN outcome (not a swallowed success) is
      // what the shim reports, and that trying twice never crashes.
      writeFileSync(realGh, '#!/usr/bin/env node\nprocess.stderr.write("HTTP 401: Bad credentials (https://api.github.com/graphql)\\n"); process.exit(1);\n');
      chmodSync(realGh, 0o755);
      writeFileSync(shimPath, renderGhShimScript({ realGhPath: realGh, cachePath }), 'utf8');
      chmodSync(shimPath, 0o755);
      try {
        writeFileSync(cachePath, JSON.stringify({ v: 2, token: 'ghs_rejected', expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString() }), 'utf8');
        expect(() => execFileSync(shimPath, ['pr', 'view', '2582'], { encoding: 'utf8' })).toThrow(/status 1|Command failed/);
        expect(existsSync(cachePath)).toBe(false); // still invalidated — the rejection was real either way
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('exits with the REAL gh\'s own exit code, transparently', () => {
      const dir = mkdtempSync(join(tmpdir(), 'we-gh-shim-live-'));
      const realGh = join(dir, 'real-gh');
      writeFileSync(realGh, '#!/usr/bin/env node\nprocess.exit(7);\n', 'utf8');
      chmodSync(realGh, 0o755);
      const shimPath = join(dir, 'gh');
      writeFileSync(shimPath, renderGhShimScript({ realGhPath: realGh, cachePath: join(dir, 'cache.json') }), 'utf8');
      chmodSync(shimPath, 0o755);
      try {
        expect(() => execFileSync(shimPath, [], { encoding: 'utf8' })).toThrow(/status 7|Command failed/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('ensureGhShim — the one real write, best-effort, never throws', () => {
  it('writes an executable file at dir/gh with the rendered content, via a real tmpdir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-gh-shim-ensure-'));
    try {
      const result = ensureGhShim({ dir, realGhPath: '/opt/homebrew/bin/gh', cachePath: '/x/cache.json' });
      expect(result).toEqual({ ok: true, path: join(dir, 'gh') });
      expect(existsSync(join(dir, 'gh'))).toBe(true);
      const content = readFileSync(join(dir, 'gh'), 'utf8');
      expect(content).toContain('/opt/homebrew/bin/gh');
      expect(content).toContain('/x/cache.json');
      // Executable — the whole point of a PATH shim.
      expect(statSync(join(dir, 'gh')).mode & 0o111).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses with {ok:false} when no real gh path is given, writing nothing', () => {
    const mkdir = vi.fn();
    const writeFile = vi.fn();
    expect(ensureGhShim({ dir: '/x', realGhPath: null, mkdir, writeFile })).toEqual({ ok: false, reason: 'no-real-gh' });
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('a failing write is swallowed — {ok:false}, never a thrown error', () => {
    const writeFile = vi.fn(() => { throw new Error('disk full'); });
    const result = ensureGhShim({ dir: '/x', realGhPath: '/bin/gh', mkdir: vi.fn(), writeFile, chmod: vi.fn() });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('write-failed');
  });
});

describe('buildGhShimSettingsEnv — the composed, OPT-IN-GATED entry point a dispatcher actually calls', () => {
  it('returns null and touches NO fs at all when App auth is not configured — the safe default for every unconfigured host (and every test)', () => {
    const exists = vi.fn();
    const writeFile = vi.fn();
    const mkdir = vi.fn();
    const result = buildGhShimSettingsEnv({ env: {}, exists, writeFile, mkdir });
    expect(result).toBeNull();
    expect(exists).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('returns null when configured but no real gh binary is found on PATH', () => {
    const result = buildGhShimSettingsEnv({ env: CONFIGURED_ENV, pathEnv: '/usr/bin', exists: () => false });
    expect(result).toBeNull();
  });

  it('configured + a real gh found: writes the shim and returns the PATH override', () => {
    const writeFile = vi.fn();
    const chmod = vi.fn();
    const mkdir = vi.fn();
    const result = buildGhShimSettingsEnv({
      env: CONFIGURED_ENV, pathEnv: '/opt/homebrew/bin:/usr/bin', dir: '/shim', cachePath: '/home/op/cache.json',
      exists: (p) => p === '/opt/homebrew/bin/gh', writeFile, chmod, mkdir,
    });
    expect(result).toEqual({ PATH: '/shim:/opt/homebrew/bin:/usr/bin' });
    expect(mkdir).toHaveBeenCalledWith('/shim', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith('/shim/gh', expect.stringContaining('/opt/homebrew/bin/gh'), 'utf8');
    expect(chmod).toHaveBeenCalledWith('/shim/gh', 0o755);
  });

  it('returns null (never throws) when the shim write itself fails', () => {
    const result = buildGhShimSettingsEnv({
      env: CONFIGURED_ENV, pathEnv: '/opt/homebrew/bin', dir: '/shim',
      exists: () => true, writeFile: () => { throw new Error('read-only fs'); }, mkdir: vi.fn(), chmod: vi.fn(),
    });
    expect(result).toBeNull();
  });
});
