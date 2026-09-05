/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description Proof of WE #3478's checkout-resolution gate: `queue-work.mjs` must find which checkout the
 *   LIVE conveyor runner is actually rooted in — via its real singleton lease + a real `lsof` pid→cwd lookup
 *   — and refuse rather than guess whenever that resolution is anything but a single, live, resolvable
 *   runner. Two layers:
 *
 *   (1) `resolveLiveRunnerLock` / `resolveLiveRunnerCheckout` — unit-tested directly against a REAL temp
 *       lock root (mirrors `skills-src/conveyor/__tests__/runner.test.mjs`'s own style) with an injected
 *       `pidCwdFn`, so no real `lsof` call is needed to cover absent / stale / ambiguous / unresolved-cwd.
 *   (2) the CLI itself — one full end-to-end case spawns a REAL dummy child process rooted in a temp
 *       "checkout" dir and points a real runner lease at its real pid, so the CLI's own `lsof` shell-out is
 *       exercised for real (the exact recipe the #3478 incident confirmed), proving `add` writes into the
 *       RESOLVED checkout, never the caller's own cwd. The refusal paths (no lock / stale lock) are also
 *       driven through the real CLI via `CONVEYOR_RUNNER_LOCK_ROOT` — no `lsof` needed since resolution
 *       never gets that far.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, realpathSync, mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireRunnerLease } from '../../../skills-src/conveyor/runner-lock.mjs';
import { resolveLiveRunnerLock, resolveLiveRunnerCheckout, pidCwd } from '../queue-work.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');
const MIN = 60_000;
const T0 = Date.parse('2026-09-05T12:00:00.000Z');

// ── (1) pure-ish resolution, real lock root + real fs, fake pid→cwd ────────────────────────────────────────

describe('resolveLiveRunnerLock — refuses rather than guesses', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'queue-work-lock-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  it('no lease at all → absent', () => {
    expect(resolveLiveRunnerLock({ lockRoot: root, nowMs: T0 })).toEqual({ ok: false, reason: 'absent' });
  });

  it('a fresh lease → ok, carries the pid forward', () => {
    acquireRunnerLease(root, 'host:4242:conveyor-runner', { pid: 4242, nowMs: T0, leaseMinutes: 15 });
    const r = resolveLiveRunnerLock({ lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15 });
    expect(r).toMatchObject({ ok: true, pid: 4242, owner: 'host:4242:conveyor-runner' });
  });

  it('a STALE lease (heartbeat past the TTL — the runner crashed) → refuses, never resolves the old cwd', () => {
    acquireRunnerLease(root, 'host:4242:conveyor-runner', { pid: 4242, nowMs: T0, leaseMinutes: 15 });
    const r = resolveLiveRunnerLock({ lockRoot: root, nowMs: T0 + 16 * MIN, leaseMinutes: 15 });
    expect(r).toMatchObject({ ok: false, reason: 'stale', owner: 'host:4242:conveyor-runner' });
  });

  it('a LIVE lease with no usable pid recorded → refuses (no-pid), never guesses a cwd', () => {
    acquireRunnerLease(root, 'host:?:conveyor-runner', { pid: null, nowMs: T0, leaseMinutes: 15 });
    const r = resolveLiveRunnerLock({ lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15 });
    expect(r).toEqual({ ok: false, reason: 'no-pid', owner: 'host:?:conveyor-runner' });
  });

  it('an AMBIGUOUS lock root (an unexpected extra entry) → refuses rather than picking one', () => {
    acquireRunnerLease(root, 'host:4242:conveyor-runner', { pid: 4242, nowMs: T0, leaseMinutes: 15 });
    // Simulate a second, unrelated lock dir under the same root (never expected — one fixed sentinel key).
    mkdirSync(join(root, 'some-other-lock-dir'));
    const r = resolveLiveRunnerLock({ lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ambiguous');
    expect(r.total).toBe(2); // the expected singleton lease dir PLUS the unexpected one
    expect(r.detail).toContain('some-other-lock-dir');
  });
});

describe('resolveLiveRunnerCheckout — the pid→cwd layer, fake pidCwdFn (no real lsof)', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'queue-work-checkout-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  it('a live lease whose pid resolves to a real dir → ok, reports that cwd', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'queue-work-target-'));
    try {
      acquireRunnerLease(root, 'host:99:conveyor-runner', { pid: 99, nowMs: T0, leaseMinutes: 15 });
      const r = resolveLiveRunnerCheckout({
        lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15, pidCwdFn: (pid) => (pid === 99 ? targetDir : null),
      });
      expect(r).toMatchObject({ ok: true, cwd: targetDir, pid: 99 });
    } finally { rmSync(targetDir, { recursive: true, force: true }); }
  });

  it('a live lease whose pid→cwd cannot be resolved (lsof failed / pid gone) → cwd-unresolved', () => {
    acquireRunnerLease(root, 'host:99:conveyor-runner', { pid: 99, nowMs: T0, leaseMinutes: 15 });
    const r = resolveLiveRunnerCheckout({
      lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15, pidCwdFn: () => null,
    });
    expect(r).toMatchObject({ ok: false, reason: 'cwd-unresolved', pid: 99 });
  });

  it('a resolved cwd that no longer exists on disk (pid reused, stale dir) → cwd-unresolved', () => {
    acquireRunnerLease(root, 'host:99:conveyor-runner', { pid: 99, nowMs: T0, leaseMinutes: 15 });
    const r = resolveLiveRunnerCheckout({
      lockRoot: root, nowMs: T0 + MIN, leaseMinutes: 15, pidCwdFn: () => '/definitely/not/a/real/path/xyz',
    });
    expect(r).toMatchObject({ ok: false, reason: 'cwd-unresolved' });
  });

  it('no lease → the checkout resolution fails the same way the lock resolution does', () => {
    expect(resolveLiveRunnerCheckout({ lockRoot: root, nowMs: T0 })).toEqual({ ok: false, reason: 'absent' });
  });
});

// ── (2) the real CLI — refusal paths need no lsof; the happy path exercises a REAL lsof call ────────────────

describe('queue-work.mjs CLI — refuses without a live lock (no lsof needed)', () => {
  let lockRoot;
  beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'queue-work-cli-lock-')); });
  afterEach(() => { try { rmSync(lockRoot, { recursive: true, force: true }); } catch { /* best-effort */ } });

  const run = (args) => execFileSync('node', [CLI, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
  });

  it('no lock at all → exits non-zero, JSON names reason:absent', () => {
    let threw = null;
    try { run(['add', '3478', '--json']); } catch (e) { threw = e; }
    expect(threw).not.toBeNull();
    expect(threw.status).toBe(1);
    expect(JSON.parse(threw.stdout)).toMatchObject({ ok: false, reason: 'absent' });
  });

  it('a STALE lock (crashed runner) → exits non-zero, JSON names reason:stale — never falls back to the caller cwd', () => {
    // Pinned well before the REAL wall clock (not a fixed date — the lease's own 15-min TTL must have
    // elapsed by the time the CLI subprocess reads `Date.now()` for real, whenever this test happens to run).
    acquireRunnerLease(lockRoot, 'host:424242:conveyor-runner', { pid: 424242, nowMs: Date.now() - 20 * MIN, leaseMinutes: 15 });
    let threw = null;
    try {
      execFileSync('node', [CLI, 'add', '3478', '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
      });
    } catch (e) { threw = e; }
    expect(threw).not.toBeNull();
    expect(threw.status).toBe(1);
    expect(JSON.parse(threw.stdout)).toMatchObject({ ok: false, reason: 'stale' });
  });

  it('an AMBIGUOUS lock root → exits non-zero, JSON names reason:ambiguous with the total and unexpected entries', () => {
    acquireRunnerLease(lockRoot, 'host:4242:conveyor-runner', { pid: 4242, nowMs: Date.now(), leaseMinutes: 15 });
    mkdirSync(join(lockRoot, 'some-other-lock-dir'));
    let threw = null;
    try { run(['add', '3478', '--json']); } catch (e) { threw = e; }
    expect(threw).not.toBeNull();
    expect(threw.status).toBe(1);
    expect(JSON.parse(threw.stdout)).toMatchObject({ ok: false, reason: 'ambiguous', total: 2, detail: ['some-other-lock-dir'] });
  });

  it('a LIVE lock with no usable pid → exits non-zero, JSON names reason:no-pid', () => {
    acquireRunnerLease(lockRoot, 'host:?:conveyor-runner', { pid: null, nowMs: Date.now(), leaseMinutes: 15 });
    let threw = null;
    try { run(['add', '3478', '--json']); } catch (e) { threw = e; }
    expect(threw).not.toBeNull();
    expect(threw.status).toBe(1);
    expect(JSON.parse(threw.stdout)).toMatchObject({ ok: false, reason: 'no-pid' });
  });
});

describe('queue-work.mjs CLI — end to end with a REAL live runner (real lsof), writes into the RESOLVED checkout', () => {
  let lockRoot;
  let targetCheckout;
  let dummy;

  beforeEach(async () => {
    lockRoot = mkdtempSync(join(tmpdir(), 'queue-work-e2e-lock-'));
    targetCheckout = realpathSync(mkdtempSync(join(tmpdir(), 'queue-work-e2e-target-')));
    // A real, long-lived process actually rooted in targetCheckout — this is what the runner lease's pid
    // stands in for. `sleep` needs no args processing and holds its cwd for the test's duration.
    dummy = spawn('sleep', ['30'], { cwd: targetCheckout, stdio: 'ignore' });
    // Poll (never a fixed sleep) until the OS/lsof actually reports the new pid's cwd, bounded so a genuinely
    // dead spawn still fails the test instead of hanging.
    const deadline = Date.now() + 5000;
    while (pidCwd(dummy.pid) == null) {
      if (Date.now() > deadline) throw new Error(`lsof never reported a cwd for dummy pid ${dummy.pid} within 5s`);
      await new Promise((r) => setTimeout(r, 20));
    }
    acquireRunnerLease(lockRoot, `host:${dummy.pid}:conveyor-runner`, { pid: dummy.pid, nowMs: Date.now(), leaseMinutes: 15 });
  });

  afterEach(() => {
    try { dummy.kill(); } catch { /* best-effort */ }
    try { rmSync(lockRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
    try { rmSync(targetCheckout, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  it('add resolves the dummy runner\'s real cwd via lsof and writes THAT checkout\'s sidecar', () => {
    const out = execFileSync('node', [CLI, 'add', '3478', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
    });
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(realpathSync(parsed.checkout)).toBe(targetCheckout);
    const sidecar = join(targetCheckout, '.conveyor', 'queue.json');
    expect(existsSync(sidecar)).toBe(true);
    expect(JSON.parse(readFileSync(sidecar, 'utf8'))).toEqual([{ num: '3478', addedAt: expect.any(String) }]);

    // A second `list` against the same live lease reads back the SAME resolved checkout's queue.
    const listOut = JSON.parse(execFileSync('node', [CLI, 'list', '--json'], {
      encoding: 'utf8', env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
    }));
    expect(listOut.queue.map((e) => e.num)).toEqual(['3478']);
  });
});
