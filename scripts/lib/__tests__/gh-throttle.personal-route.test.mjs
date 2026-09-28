/**
 * @file scripts/lib/__tests__/gh-throttle.personal-route.test.mjs
 * @description we:backlog/xhcgdce — the whole fleet's `gh` calls share ONE GitHub App installation's 5,000
 *   point/hour GraphQL budget, exhausted fleet-wide 3+ times in one day. This proves the short-term fix: a
 *   classified READ can be routed onto the operator's own personal GitHub identity (a separate 5,000/hr
 *   allowance) while every WRITE stays on the App, unconditionally — including the "soak break" this card's
 *   Done-when names: a read burst that already exhausted the App's own bucket no longer blocks reads once the
 *   split is enabled, because the personal identity's budget bucket is a genuinely separate one
 *   (`readBudgetBlock`/`writeBudgetBlock` already key on `ghAuthIdentity` — #gh-graphql-budget).
 *
 *   OFF BY DEFAULT (`resolvePersonalRouteEnabled`) — every scenario below sets `throttle.personalRoute: true`
 *   explicitly except the very first, which proves the opposite: with NO flag and NO env var, behavior is
 *   byte-identical to every `gh-throttle.mjs` test written before this card (see that file's own env
 *   assertions) — the regression pin for the rest of the suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyGhRead, personalGhToken, resetPersonalGhTokenCacheForTest, looksLikeGhAuthFailure,
  resolvePersonalRouteEnabled, runGhCliPassthrough, ghAuthIdentity, writeBudgetBlock, readBudgetBlock,
  ghThrottleLogPath,
} from '../gh-throttle.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'gh-personal-route-'));
// #4309's cost-header capture defaults ON and always sets an explicit `env` key (to add `GH_DEBUG=api`) — kept
// OFF here (`WE_GH_THROTTLE_COST_HEADERS: '0'`) so a bare `spawn.mock.calls[…][2].env` assertion below tests
// THIS card's own env-override behavior, not that unrelated feature's.
const APP_ENV = { GH_TOKEN: 'ghs_appToken', HOME: '/h', WE_GH_THROTTLE_COST_HEADERS: '0' };
const PERSONAL_TOKEN = 'gho_personalToken';
const personalIdentity = ghAuthIdentity({ GH_TOKEN: PERSONAL_TOKEN });

describe('classifyGhRead — the conservative read allowlist', () => {
  it('allows pr list/view/checks, run list/view, search, and a plain/explicit-GET api call', () => {
    expect(classifyGhRead(['pr', 'list'])).toBe(true);
    expect(classifyGhRead(['pr', 'view', '1'])).toBe(true);
    expect(classifyGhRead(['pr', 'checks', '1'])).toBe(true);
    expect(classifyGhRead(['run', 'list'])).toBe(true);
    expect(classifyGhRead(['run', 'view', '1'])).toBe(true);
    expect(classifyGhRead(['search', 'issues', 'foo'])).toBe(true);
    expect(classifyGhRead(['api', 'repos/o/n'])).toBe(true);
    expect(classifyGhRead(['api', '--method', 'GET', 'repos/o/n'])).toBe(true);
    expect(classifyGhRead(['api', '-X', 'GET', 'repos/o/n'])).toBe(true);
  });

  it('defaults UNKNOWN/ambiguous to write/App — never a false positive', () => {
    expect(classifyGhRead(['pr', 'comment', '1'])).toBe(false);
    expect(classifyGhRead(['pr', 'merge', '1'])).toBe(false);
    expect(classifyGhRead(['issue', 'view', '1'])).toBe(false); // conservative: not on the literal allowlist
    expect(classifyGhRead(['label', 'list'])).toBe(false); // conservative: not on the literal allowlist
    expect(classifyGhRead(['gist', 'list'])).toBe(false); // wholly unrecognized
  });

  it('recognizes every spelling of a mutating method (review-2026-09-28 finding: -X/--method= were missed)', () => {
    expect(classifyGhRead(['api', '-X', 'DELETE', 'repos/o/n/labels/x'])).toBe(false);
    expect(classifyGhRead(['api', '-X', 'POST', 'repos/o/n/dispatches'])).toBe(false);
    expect(classifyGhRead(['api', '--method=DELETE', 'repos/o/n/labels/x'])).toBe(false);
    expect(classifyGhRead(['api', '-XDELETE', 'repos/o/n/labels/x'])).toBe(false);
  });

  it('a GET with a payload flag stays conservative (write/App) — a documented MVP gap, never a false positive', () => {
    expect(classifyGhRead(['api', '--method', 'GET', 'repos/o/n/pulls/1/files', '-F', 'per_page=100'])).toBe(false);
    expect(classifyGhRead(['api', 'graphql', '-f', 'query=query{viewer{login}}'])).toBe(false);
  });

  it('strips leading global flags so a subcommand is not missed (review-2026-09-28 finding)', () => {
    expect(classifyGhRead(['-R', 'o/n', 'pr', 'list'])).toBe(true);
    expect(classifyGhRead(['--repo', 'o/n', 'pr', 'view', '1'])).toBe(true);
    expect(classifyGhRead(['--hostname', 'ghe.example.com', 'pr', 'list'])).toBe(true);
  });
});

describe("personalGhToken — the operator's own gh CLI login, never the App/logged token", () => {
  beforeEach(() => resetPersonalGhTokenCacheForTest());

  it('strips GH_TOKEN/GITHUB_TOKEN before shelling the real binary, and returns only what it reads back', () => {
    const exec = vi.fn((bin, args, opts) => {
      expect(opts.env.GH_TOKEN).toBeUndefined();
      expect(opts.env.GITHUB_TOKEN).toBeUndefined();
      expect(args).toEqual(['auth', 'token']);
      return 'gho_personalSecret123\n';
    });
    expect(personalGhToken({ bin: '/real/gh', exec })).toBe('gho_personalSecret123');
    expect(exec).toHaveBeenCalledWith('/real/gh', ['auth', 'token'], expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }));
  });

  it('caches for the process — one shell-out even across repeated calls', () => {
    const exec = vi.fn(() => 'tok\n');
    personalGhToken({ exec });
    personalGhToken({ exec });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('any failure (missing gh, not logged in, empty output) resolves to null, never throws', () => {
    expect(personalGhToken({ exec: () => { throw new Error('not logged in'); } })).toBe(null);
    resetPersonalGhTokenCacheForTest();
    expect(personalGhToken({ exec: () => '' })).toBe(null);
    resetPersonalGhTokenCacheForTest();
    expect(personalGhToken({ exec: () => '   \n' })).toBe(null);
  });
});

describe('looksLikeGhAuthFailure / resolvePersonalRouteEnabled — pure classifiers', () => {
  it('looksLikeGhAuthFailure matches HTTP 401 / Bad credentials, never a rate limit', () => {
    expect(looksLikeGhAuthFailure('HTTP 401: Bad credentials')).toBe(true);
    expect(looksLikeGhAuthFailure('gh: Bad credentials (HTTP 401)')).toBe(true);
    expect(looksLikeGhAuthFailure('API rate limit exceeded')).toBe(false);
    expect(looksLikeGhAuthFailure('')).toBe(false);
    expect(looksLikeGhAuthFailure(null)).toBe(false);
  });

  it('resolvePersonalRouteEnabled defaults OFF and only turns on for recognized truthy spellings', () => {
    expect(resolvePersonalRouteEnabled({})).toBe(false);
    expect(resolvePersonalRouteEnabled({ WE_GH_THROTTLE_PERSONAL_ROUTE: '0' })).toBe(false);
    expect(resolvePersonalRouteEnabled({ WE_GH_THROTTLE_PERSONAL_ROUTE: 'false' })).toBe(false);
    expect(resolvePersonalRouteEnabled({ WE_GH_THROTTLE_PERSONAL_ROUTE: '1' })).toBe(true);
    expect(resolvePersonalRouteEnabled({ WE_GH_THROTTLE_PERSONAL_ROUTE: 'true' })).toBe(true);
  });
});

describe('runGhCliPassthrough — the gh read/App-write identity split (we:backlog/xhcgdce)', () => {
  it('OFF BY DEFAULT — byte-identical to before this card, even for a classified read with a token available', () => {
    const lockRoot = tmp();
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.from('ok'), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, env: APP_ENV, personalToken: PERSONAL_TOKEN }, spawn });
    expect(spawn.mock.calls[0][2].env).toBeUndefined(); // no personalRoute flag/env var → no override at all
  });

  it('THE SOAK-BREAK PROOF — a read is no longer blocked by the App bucket\'s own exhaustion once enabled', () => {
    const lockRoot = tmp();
    // The App identity's graphql bucket is already exhausted — the exact incident this card fixes.
    writeBudgetBlock(lockRoot, 'app', 'graphql', { untilMs: Date.now() + 3600_000, nowMs: Date.now() });
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.from('[]'), stderr: Buffer.alloc(0) }));

    // BEFORE (the split not enabled): the same read stays blocked, fails fast, unchanged from today.
    const before = runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, env: APP_ENV }, spawn });
    expect(before.status).toBe(1);
    expect(spawn).not.toHaveBeenCalled();

    // AFTER: personalRoute enabled + a personal token available → the read spends the PERSONAL identity's own
    // bucket (untouched by the App's block) and actually reaches gh.
    const after = runGhCliPassthrough(['pr', 'list'], {
      throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN }, spawn,
    });
    expect(after.status).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][2].env.GH_TOKEN).toBe(PERSONAL_TOKEN);
    expect(readBudgetBlock(lockRoot, personalIdentity, 'graphql')).toBe(null);
  });

  it('a write is NEVER routed to the personal token, even enabled with a token available', () => {
    const lockRoot = tmp();
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['pr', 'comment', '1', '--body', 'x'], {
      throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN }, spawn,
    });
    expect(spawn.mock.calls[0][2].env).toBeUndefined(); // unchanged App env — no override at all
  });

  it('an unrecognized/ambiguous shape defaults to write/App even though it mutates nothing the classifier knows', () => {
    const lockRoot = tmp();
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['gist', 'list'], {
      throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN }, spawn,
    });
    expect(spawn.mock.calls[0][2].env).toBeUndefined();
  });

  it('a missing personal token falls back to the App transparently, no override', () => {
    const lockRoot = tmp();
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: null }, spawn });
    expect(spawn.mock.calls[0][2].env).toBeUndefined();
  });

  it("a caller's own explicit non-App/non-default token is left completely alone (never hijacked)", () => {
    const lockRoot = tmp();
    const callerEnv = { GH_TOKEN: 'gho_someOtherCallersOwnToken', WE_GH_THROTTLE_COST_HEADERS: '0' };
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, env: callerEnv, personalRoute: true, personalToken: PERSONAL_TOKEN }, spawn });
    expect(spawn.mock.calls[0][2].env).toBeUndefined();
  });

  it('a REJECTED personal token falls back to the App identity ONCE, transparently', () => {
    const lockRoot = tmp();
    let call = 0;
    const spawn = vi.fn((bin, argv, opts) => {
      call += 1;
      if (call === 1) {
        expect(opts.env.GH_TOKEN).toBe(PERSONAL_TOKEN);
        return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('HTTP 401: Bad credentials') };
      }
      expect(opts.env).toBeUndefined(); // second attempt reverted to the plain, unmodified App env
      return { status: 0, stdout: Buffer.from('ok'), stderr: Buffer.alloc(0) };
    });
    const r = runGhCliPassthrough(['pr', 'list'], {
      throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN, sleep: () => {} }, spawn,
    });
    expect(r.status).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('a rejected personal token does not retry against an App bucket already known exhausted', () => {
    const lockRoot = tmp();
    writeBudgetBlock(lockRoot, 'app', 'graphql', { untilMs: Date.now() + 3600_000, nowMs: Date.now() });
    const spawn = vi.fn(() => ({ status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('HTTP 401: Bad credentials') }));
    const r = runGhCliPassthrough(['pr', 'list'], {
      throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN, sleep: () => {} }, spawn,
    });
    expect(spawn).toHaveBeenCalledTimes(1); // the rejected personal-token attempt only — no doomed App retry
    expect(r.stderr.toString()).toMatch(/shared backoff until/);
  });

  it('records the resolved identity on the sidecar log line (the health smell)', () => {
    const lockRoot = tmp();
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.from('ok'), stderr: Buffer.alloc(0) }));
    runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, env: APP_ENV, personalRoute: true, personalToken: PERSONAL_TOKEN }, spawn });
    const lines = readFileSync(ghThrottleLogPath(lockRoot), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines[0].id).toBe(personalIdentity);
  });
});
