/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description CLI roundtrip proof for `queue-work.mjs` (WE #3478) — runs the real CLI as a subprocess
 *   against a TEMP runner-lock root (`CONVEYOR_RUNNER_LOCK_ROOT`) and a temp checkout, exercising the item's
 *   "Done when" cases: (a) a live runner lock whose pid's command line + cwd both resolve, against a real
 *   checkout → the RESOLVED checkout's `.conveyor/queue.json` gets the entry, not the caller's own cwd's;
 *   (b) no live lock → refuses rather than silently succeeding; (c) a stale or ambiguous lock set → the
 *   ambiguity is surfaced, not silently resolved. Case (a) spawns a REAL long-lived child process — running a
 *   script at a path ending `skills-src/conveyor/runner.mjs`, so the pid-identity check passes — with a known
 *   `cwd` that carries a `.git` marker, and points a fabricated lock entry at its real pid, so the `lsof`
 *   pid→cwd resolution and the `ps` pid→identity check this item is built on are both exercised for real, not
 *   mocked — mirroring how the #3478 incident itself was diagnosed (`ps`/`lsof` against the real runner pid).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');

let dir, lockRoot, checkoutDir;
const run = (args) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
  });
const writeLock = (name, entry) => {
  const d = join(lockRoot, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'lock.json'), JSON.stringify(entry));
};
/** Spawn a REAL long-lived child whose command line ends `skills-src/conveyor/runner.mjs` (so the
 *  pid-identity check passes) and whose cwd is `cwd` (so the pid→cwd resolution has a real, known answer). */
const spawnFakeRunner = (cwd) => {
  const scriptDir = join(dir, 'skills-src', 'conveyor');
  mkdirSync(scriptDir, { recursive: true });
  const script = join(scriptDir, 'runner.mjs');
  writeFileSync(script, 'setTimeout(() => {}, 30000);\n');
  return spawn('node', [script], { cwd, stdio: 'ignore' });
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'conveyor-queue-work-'));
  lockRoot = join(dir, 'locks');
  checkoutDir = join(dir, 'checkout');
  mkdirSync(lockRoot, { recursive: true });
  mkdirSync(join(checkoutDir, '.git'), { recursive: true }); // the `looksLikeCheckout` marker
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('queue-work.mjs CLI — resolves the LIVE runner checkout, never the caller\'s own cwd', () => {
  let child;
  afterEach(() => { if (child) child.kill(); });

  it('a live lock whose pid resolves via lsof + ps → writes into THAT checkout, reports which one', () => {
    child = spawnFakeRunner(checkoutDir);
    writeLock('runner', { owner: `host:${child.pid}:conveyor-runner`, pid: child.pid, heartbeatAt: new Date().toISOString() });

    const out = JSON.parse(run(['add', '3478', '--json']));
    expect(out.ok).toBe(true);
    expect(realpathSync(out.checkoutRoot)).toBe(realpathSync(checkoutDir));

    const sidecar = JSON.parse(readFileSync(join(checkoutDir, '.conveyor', 'queue.json'), 'utf8'));
    expect(sidecar.map((e) => e.num)).toEqual(['3478']);
  });

  it('list reads back the resolved checkout\'s queue, not the caller\'s cwd\'s', () => {
    child = spawnFakeRunner(checkoutDir);
    writeLock('runner', { owner: `host:${child.pid}:conveyor-runner`, pid: child.pid, heartbeatAt: new Date().toISOString() });

    run(['add', '3478']);
    const out = JSON.parse(run(['list', '--json']));
    expect(out.queue.map((e) => e.num)).toEqual(['3478']);
  });
});

describe('queue-work.mjs CLI — refuses rather than silently succeeding', () => {
  it('no lock at all → refuses (non-zero exit), reason no-lock', () => {
    expect(() => run(['add', '3478'])).toThrow();
    try { run(['add', '3478', '--json']); } catch (e) {
      const out = JSON.parse(e.stdout);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('no-lock');
    }
  });

  it('`list` also refuses on no live lock — the guard is not `add`-only', () => {
    try { run(['list', '--json']); throw new Error('should have refused'); } catch (e) {
      const out = JSON.parse(e.stdout);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('no-lock');
    }
  });

  it('`remove` also refuses on no live lock — the shared guard covers all three verbs', () => {
    try { run(['remove', '3478', '--json']); throw new Error('should have refused'); } catch (e) {
      const out = JSON.parse(e.stdout);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('no-lock');
    }
  });

  it('a stale lock (heartbeat long expired) → refuses, reason stale — never queues into a dead runner\'s checkout', () => {
    writeLock('dead-runner', { owner: 'host:999999:conveyor-runner', pid: 999999, heartbeatAt: new Date(Date.now() - 60 * 60_000).toISOString() });
    try { run(['add', '3478', '--json']); throw new Error('should have refused'); } catch (e) {
      const out = JSON.parse(e.stdout);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('stale');
    }
  });

  it('two live locks at once → refuses, reason ambiguous — never guesses which one is real', () => {
    const fresh = new Date().toISOString();
    writeLock('one', { owner: 'host:111:conveyor-runner', pid: 111, heartbeatAt: fresh });
    writeLock('two', { owner: 'host:222:conveyor-runner', pid: 222, heartbeatAt: fresh });
    try { run(['add', '3478', '--json']); throw new Error('should have refused'); } catch (e) {
      const out = JSON.parse(e.stdout);
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('ambiguous');
    }
  });

  it('a live lock pointing at a REAL process that is not the runner → refuses, reason pid-identity-mismatch (#3478 review: a heartbeat proves the lease was held recently, not that this pid is still that process)', () => {
    const child = spawn('node', ['-e', 'setTimeout(() => {}, 30000)'], { cwd: checkoutDir, stdio: 'ignore' });
    try {
      writeLock('impostor', { owner: `host:${child.pid}:conveyor-runner`, pid: child.pid, heartbeatAt: new Date().toISOString() });
      try { run(['add', '3478', '--json']); throw new Error('should have refused'); } catch (e) {
        const out = JSON.parse(e.stdout);
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('pid-identity-mismatch');
      }
    } finally { child.kill(); }
  });

  it('a live, correctly-identified runner whose resolved cwd is NOT a git checkout → refuses, reason checkout-unverifiable (#3478 review round 2, correctness)', () => {
    const notACheckout = join(dir, 'not-a-checkout');
    mkdirSync(notACheckout, { recursive: true }); // deliberately no `.git`
    const child = spawnFakeRunner(notACheckout);
    try {
      writeLock('runner', { owner: `host:${child.pid}:conveyor-runner`, pid: child.pid, heartbeatAt: new Date().toISOString() });
      try { run(['add', '3478', '--json']); throw new Error('should have refused'); } catch (e) {
        const out = JSON.parse(e.stdout);
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('checkout-unverifiable');
      }
    } finally { child.kill(); }
  });
});
