/**
 * @file scripts/lib/__tests__/gh-throttle.test.mjs
 * @description Unit proof of the #3621 `gh`-call throttle wrapper: env-tuning resolution, the rate-limit
 *   classifier (mirrors `infra-blocked.mjs`'s already-incident-grounded regex), bounded exponential backoff,
 *   the concurrency semaphore (against a REAL temp lock root, mirroring `heavy-admission.test.mjs`'s own
 *   discipline of proving the atomic fs layer for real), and `runGhSync`'s retry/pass-through logic with a
 *   MOCKED `gh` exec (no real subprocess, no real `gh` binary needed) — the real, unmocked, side-by-side
 *   fidelity proof against the actual `gh` binary lives in `scripts/lib/__tests__/gh-throttle.fidelity.test.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_GH_CONCURRENCY_CAP, DEFAULT_ACQUIRE_TIMEOUT_MS, DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_BASE_MS, DEFAULT_RETRY_CAP_MS,
  resolveGhCap, resolveAcquireTimeoutMs, resolveRetryMaxAttempts,
  isRateLimitShaped, retryBackoffMs,
  acquireGhSlotSync, releaseGhSlotSync, ghThrottleStatus,
  runGhSync, execFileSyncThrottled, runGhCliPassthrough,
} from '../gh-throttle.mjs';

// ── env tuning ───────────────────────────────────────────────────────────────────────────────────────────
describe('resolveGhCap / resolveAcquireTimeoutMs / resolveRetryMaxAttempts — env override, clamped sane', () => {
  it('defaults when unset', () => {
    expect(resolveGhCap({})).toBe(DEFAULT_GH_CONCURRENCY_CAP);
    expect(resolveAcquireTimeoutMs({})).toBe(DEFAULT_ACQUIRE_TIMEOUT_MS);
    expect(resolveRetryMaxAttempts({})).toBe(DEFAULT_RETRY_MAX_ATTEMPTS);
  });
  it('reads the WE_GH_THROTTLE_* env vars', () => {
    expect(resolveGhCap({ WE_GH_THROTTLE_CAP: '3' })).toBe(3);
    expect(resolveAcquireTimeoutMs({ WE_GH_THROTTLE_ACQUIRE_TIMEOUT_MS: '5000' })).toBe(5000);
    expect(resolveRetryMaxAttempts({ WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS: '2' })).toBe(2);
  });
  it('falls back on a non-finite or invalid value', () => {
    expect(resolveGhCap({ WE_GH_THROTTLE_CAP: 'nope' })).toBe(DEFAULT_GH_CONCURRENCY_CAP);
    expect(resolveGhCap({ WE_GH_THROTTLE_CAP: '0' })).toBe(DEFAULT_GH_CONCURRENCY_CAP);
    expect(resolveRetryMaxAttempts({ WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS: '0' })).toBe(DEFAULT_RETRY_MAX_ATTEMPTS);
  });
});

// ── rate-limit classification — reused from infra-blocked.mjs, not re-guessed ──────────────────────────────
describe('isRateLimitShaped — real GitHub secondary/primary rate-limit phrasing', () => {
  it('matches the documented secondary-rate-limit phrasing', () => {
    expect(isRateLimitShaped('gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)')).toBe(true);
  });
  it('matches the documented primary-rate-limit phrasing', () => {
    expect(isRateLimitShaped('API rate limit exceeded for installation ID 123.')).toBe(true);
  });
  it('matches the abuse-detection phrasing (GitHub’s older secondary-limit wording)', () => {
    expect(isRateLimitShaped('You have triggered an abuse detection mechanism.')).toBe(true);
  });
  it('does NOT match an unrelated gh failure (a genuine error must fail open, not loop a doomed retry)', () => {
    expect(isRateLimitShaped('gh: pull request #123 already exists')).toBe(false);
    expect(isRateLimitShaped('gh: HTTP 404: Not Found')).toBe(false);
    expect(isRateLimitShaped('')).toBe(false);
    expect(isRateLimitShaped(null)).toBe(false);
    expect(isRateLimitShaped(undefined)).toBe(false);
  });
});

describe('retryBackoffMs — bounded exponential, never instant and never unbounded', () => {
  it('doubles per attempt from the base', () => {
    expect(retryBackoffMs(1, { baseMs: 1000, factor: 2, capMs: 60000 })).toBe(1000);
    expect(retryBackoffMs(2, { baseMs: 1000, factor: 2, capMs: 60000 })).toBe(2000);
    expect(retryBackoffMs(3, { baseMs: 1000, factor: 2, capMs: 60000 })).toBe(4000);
  });
  it('never exceeds the cap however large the attempt', () => {
    expect(retryBackoffMs(20, { baseMs: 1000, factor: 2, capMs: 60000 })).toBe(60000);
  });
  it('is never zero — a rate-limit retry is never instant', () => {
    expect(retryBackoffMs(1)).toBe(DEFAULT_RETRY_BASE_MS);
    expect(retryBackoffMs(1)).toBeGreaterThan(0);
  });
  it('clamps a sub-1 attempt to attempt 1 (defensive — never a negative exponent)', () => {
    expect(retryBackoffMs(0)).toBe(DEFAULT_RETRY_BASE_MS);
    expect(retryBackoffMs(-5)).toBe(DEFAULT_RETRY_BASE_MS);
  });
  it('honors an explicit cap smaller than the default', () => {
    expect(retryBackoffMs(10, { capMs: 5000 })).toBeLessThanOrEqual(5000);
  });
});

// ── the concurrency semaphore — REAL temp lock root, mirrors heavy-admission.test.mjs ──────────────────────
describe('acquireGhSlotSync / releaseGhSlotSync — cap-independent slots over a real lock root', () => {
  let lockRoot;
  beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'gh-throttle-test-')); });
  afterEach(() => { rmSync(lockRoot, { recursive: true, force: true }); });

  it('admits up to cap concurrent owners synchronously, then times out (fail OPEN) on a (cap+1)th', () => {
    const cap = 2;
    let clock = 0;
    const now = () => clock;
    const sleep = (ms) => { clock += ms; };
    const a = acquireGhSlotSync({ lockRoot, cap, owner: 'A', now, sleep, timeoutMs: 10 });
    const b = acquireGhSlotSync({ lockRoot, cap, owner: 'B', now, sleep, timeoutMs: 10 });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(new Set([a.slot, b.slot]).size).toBe(2);

    const c = acquireGhSlotSync({ lockRoot, cap, owner: 'C', now, sleep, pollMs: 5, timeoutMs: 20 });
    expect(c.ok).toBe(false);
    expect(c.timedOut).toBe(true);
    expect(ghThrottleStatus({ lockRoot, cap }).heldCount).toBe(2);
  });

  it('release frees the slot for a new owner', () => {
    const cap = 1;
    const now = () => 0;
    const sleep = () => {};
    const a = acquireGhSlotSync({ lockRoot, cap, owner: 'A', now, sleep, timeoutMs: 10 });
    expect(a.ok).toBe(true);
    releaseGhSlotSync({ lockRoot, cap, owner: 'A' });
    expect(ghThrottleStatus({ lockRoot, cap }).heldCount).toBe(0);
    const b = acquireGhSlotSync({ lockRoot, cap, owner: 'B', now, sleep, timeoutMs: 10 });
    expect(b.ok).toBe(true);
  });

  it('the gh-throttle lock root is a SIBLING of, never inside, heavy-admission’s own root', async () => {
    const { admissionLockRoot } = await import('../../readiness/heavy-admission.mjs');
    const { ghThrottleLockRoot } = await import('../gh-throttle.mjs');
    const heavy = admissionLockRoot('/some/checkout', {});
    const gh = ghThrottleLockRoot('/some/checkout', {});
    expect(gh).not.toBe(heavy);
    expect(gh.endsWith(join('.admission', 'gh'))).toBe(true);
    expect(heavy.endsWith(join('.admission', 'heavy'))).toBe(true);
  });
});

// ── runGhSync — the importable, transparent, mocked-exec retry/pass-through proof ──────────────────────────
function ghError({ status = 1, stderr = '', message = '' } = {}) {
  const e = new Error(message || `Command failed: gh (exit ${status})`);
  e.status = status;
  e.stderr = stderr;
  return e;
}

describe('runGhSync — transparent success pass-through', () => {
  it('returns exactly what exec returns, no retry, on a clean success', () => {
    const exec = vi.fn(() => 'hello stdout');
    const out = runGhSync(['pr', 'view', '1'], { throttle: { lockRoot: mkdtempSync(join(tmpdir(), 'gh-t-')), cap: 2, sleep: () => {}, exec } });
    expect(out).toBe('hello stdout');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('passes `args` and the real execOpts through to exec UNCHANGED, with `throttle` stripped', () => {
    const exec = vi.fn(() => 'ok');
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    runGhSync(['api', 'rate_limit'], { encoding: 'utf8', maxBuffer: 123, throttle: { lockRoot, cap: 2, sleep: () => {}, exec } });
    expect(exec).toHaveBeenCalledWith(['api', 'rate_limit'], { encoding: 'utf8', maxBuffer: 123 });
  });
});

describe('runGhSync — a NON-rate-limit failure is never retried, and re-thrown byte-identical', () => {
  it('throws the exact original error object after exactly one attempt', () => {
    const original = ghError({ status: 1, stderr: 'gh: pull request #9 already exists' });
    const exec = vi.fn(() => { throw original; });
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    let caught = null;
    try {
      runGhSync(['pr', 'create'], { throttle: { lockRoot, cap: 2, sleep: () => {}, exec } });
    } catch (e) { caught = e; }
    expect(caught).toBe(original);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('runGhSync — a rate-limit-shaped failure backs off and retries, bounded', () => {
  it('retries with a real, bounded exponential backoff and eventually succeeds', () => {
    let calls = 0;
    const exec = vi.fn(() => {
      calls += 1;
      if (calls < 3) throw ghError({ status: 1, stderr: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' });
      return 'succeeded on attempt 3';
    });
    const sleepCalls = [];
    const sleep = (ms) => sleepCalls.push(ms);
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const out = runGhSync(['pr', 'list'], {
      throttle: { lockRoot, cap: 2, sleep, exec, maxAttempts: 5, retryBaseMs: 100, retryCapMs: 10000 },
    });
    expect(out).toBe('succeeded on attempt 3');
    expect(exec).toHaveBeenCalledTimes(3);
    // Two backoff sleeps (before attempt 2 and attempt 3), STRICTLY increasing (never instant, doubling).
    expect(sleepCalls.length).toBe(2);
    expect(sleepCalls[0]).toBe(100);
    expect(sleepCalls[1]).toBe(200);
  });

  it('gives up after maxAttempts and re-throws the LAST real failure unchanged', () => {
    const errors = [
      ghError({ status: 1, stderr: 'secondary rate limit hit #1' }),
      ghError({ status: 1, stderr: 'secondary rate limit hit #2' }),
      ghError({ status: 1, stderr: 'secondary rate limit hit #3 — the final, re-thrown one' }),
    ];
    let calls = 0;
    const exec = vi.fn(() => { const e = errors[calls]; calls += 1; throw e; });
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    let caught = null;
    try {
      runGhSync(['pr', 'list'], { throttle: { lockRoot, cap: 2, sleep: () => {}, exec, maxAttempts: 3, retryBaseMs: 1 } });
    } catch (e) { caught = e; }
    expect(caught).toBe(errors[2]);
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it('releases its concurrency slot BEFORE sleeping between retries — a backoff never idles a scarce slot', () => {
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const cap = 1;
    let calls = 0;
    const exec = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw ghError({ status: 1, stderr: 'secondary rate limit' });
      return 'ok';
    });
    const sleep = vi.fn((_ms) => {
      // While "sleeping" (mid-retry, between attempt 1 and 2), the slot must be FREE for another owner.
      const status = ghThrottleStatus({ lockRoot, cap });
      expect(status.heldCount).toBe(0);
    });
    const out = runGhSync(['pr', 'list'], { throttle: { lockRoot, cap, sleep, exec, maxAttempts: 3, retryBaseMs: 1 } });
    expect(out).toBe('ok');
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

// ── execFileSyncThrottled — the execFileSync(file, args, opts)-shaped adapter ───────────────────────────────
describe('execFileSyncThrottled', () => {
  it('delegates to runGhSync (and therefore the throttle) when file === "gh"', () => {
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const exec = vi.fn(() => 'throttled-out');
    const out = execFileSyncThrottled('gh', ['run', 'list'], { throttle: { lockRoot, cap: 2, sleep: () => {}, exec } });
    expect(out).toBe('throttled-out');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('falls through to the REAL execFileSync for any other binary (defensive — never used by a real caller)', () => {
    const out = execFileSyncThrottled('node', ['-e', 'process.stdout.write("plain")'], { encoding: 'utf8' });
    expect(out).toBe('plain');
  });
});

// ── runGhCliPassthrough — the process-level transparency contract, with an INJECTED spawn ────────────────────
describe('runGhCliPassthrough — full-process transparency, injected spawn', () => {
  it('relays a successful child’s stdout, stderr, and exit status untouched', () => {
    const spawn = vi.fn(() => ({ status: 0, stdout: Buffer.from('out-bytes'), stderr: Buffer.from('warn-bytes'), error: null }));
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const r = runGhCliPassthrough(['pr', 'view', '1'], { throttle: { lockRoot, cap: 2, sleep: () => {} }, spawn });
    expect(r.status).toBe(0);
    expect(r.stdout.toString()).toBe('out-bytes');
    expect(r.stderr.toString()).toBe('warn-bytes'); // stderr survives a SUCCESSFUL call — the execFileSync gap this mode exists to avoid
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('retries a rate-limit-shaped nonzero exit, then relays the eventual success', () => {
    let calls = 0;
    const spawn = vi.fn(() => {
      calls += 1;
      if (calls < 2) return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('You have exceeded a secondary rate limit.'), error: null };
      return { status: 0, stdout: Buffer.from('finally'), stderr: Buffer.alloc(0), error: null };
    });
    const sleep = vi.fn();
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const r = runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, cap: 2, sleep, maxAttempts: 3, retryBaseMs: 1 }, spawn });
    expect(r.status).toBe(0);
    expect(r.stdout.toString()).toBe('finally');
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('relays a NON-rate-limit nonzero exit immediately, with no retry', () => {
    const spawn = vi.fn(() => ({ status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('gh: pull request #9 already exists'), error: null }));
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    const r = runGhCliPassthrough(['pr', 'create'], { throttle: { lockRoot, cap: 2, sleep: () => {} }, spawn });
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toBe('gh: pull request #9 already exists');
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('re-throws a spawn-level error (e.g. gh not on PATH) rather than misreading it as a gh-level failure', () => {
    const spawnErr = new Error('ENOENT');
    const spawn = vi.fn(() => ({ status: null, stdout: null, stderr: null, error: spawnErr }));
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-t-'));
    expect(() => runGhCliPassthrough(['pr', 'list'], { throttle: { lockRoot, cap: 2, sleep: () => {} }, spawn })).toThrow(spawnErr);
  });
});
