/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description CLI proof of the queue-target-safe clear-for-build command (WE #3478). Runs the real
 *   `queue-work.mjs {add|remove|list}` as a subprocess, pointing it at a temp `CONVEYOR_RUNNER_LOCK_ROOT`
 *   holding a hand-written lock entry for a REAL spawned child process (so the pid→cwd `lsof` resolution is
 *   exercised end-to-end, not stubbed) — the sidecar it writes into is asserted to be the CHILD's cwd, not
 *   the CLI's own script location (the #3478 bug: `queue.mjs` writes wherever ITS OWN script happens to
 *   live, regardless of which checkout the live runner is actually rooted in). Also pins the two refusal
 *   cases: no live lock at all, and more than one live lock (ambiguous) — neither writes anything.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');

const FRESH = () => new Date().toISOString();
const STALE = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

function writeLockEntry(lockRoot, key, entry) {
  const dir = join(lockRoot, key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'lock.json'), JSON.stringify(entry));
}

const run = (args, lockRoot) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
  });

const runExpectFail = (args, lockRoot) => {
  try {
    run(args, lockRoot);
    throw new Error('expected queue-work.mjs to exit non-zero');
  } catch (e) {
    return e.stdout;
  }
};

describe('queue-work.mjs CLI — resolves the LIVE runner checkout before writing', () => {
  let lockRoot, checkoutDir, child;

  beforeEach(() => {
    lockRoot = mkdtempSync(join(tmpdir(), 'runner-lock-root-'));
    checkoutDir = mkdtempSync(join(tmpdir(), 'runner-checkout-'));
  });

  afterEach(() => {
    if (child) child.kill();
    rmSync(lockRoot, { recursive: true, force: true });
    rmSync(checkoutDir, { recursive: true, force: true });
  });

  it('add writes into the LIVE runner checkout\'s sidecar, not the CLI\'s own script location', async () => {
    child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { cwd: checkoutDir, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 200));
    writeLockEntry(lockRoot, 'runner', { owner: 'h:test:conveyor-runner', pid: child.pid, heartbeatAt: FRESH() });

    const out = JSON.parse(run(['add', '3478', '--json'], lockRoot));
    expect(out.ok).toBe(true);
    // macOS resolves `/tmp`-style paths through `/private` — compare realpaths, not raw strings.
    expect(out.checkout).toBe(realpathSync(checkoutDir));

    const sidecar = join(checkoutDir, '.conveyor', 'queue.json');
    expect(existsSync(sidecar)).toBe(true);
    expect(JSON.parse(readFileSync(sidecar, 'utf8'))[0].num).toBe('3478');

    // never wrote anywhere under the CLI's own repo
    expect(existsSync(join(HERE, '..', '..', '..', '.conveyor', 'queue.json'))).toBe(false);
  });

  it('no live lock at all → refuses (no-live-runner), writes nothing', () => {
    const out = JSON.parse(runExpectFail(['add', '3478', '--json'], lockRoot));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no-live-runner');
    expect(existsSync(join(checkoutDir, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('a stale lock only → still refuses (no-live-runner), never targets the dead runner\'s old cwd', () => {
    writeLockEntry(lockRoot, 'runner', { owner: 'h:test:conveyor-runner', pid: 999999, heartbeatAt: STALE() });
    const out = JSON.parse(runExpectFail(['add', '3478', '--json'], lockRoot));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no-live-runner');
  });

  it('a fresh heartbeat naming a pid whose cwd cannot be resolved → refuses (cwd-unresolvable)', () => {
    // FRESH heartbeat (so the lease itself reads live) but no real process behind the pid — `lsof` finds
    // nothing to resolve, distinct from the no-live-runner (stale lease) and ambiguous (>1 live lease) cases.
    writeLockEntry(lockRoot, 'runner', { owner: 'h:test:conveyor-runner', pid: 999999, heartbeatAt: FRESH() });
    const out = JSON.parse(runExpectFail(['add', '3478', '--json'], lockRoot));
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('cwd-unresolvable');
    expect(existsSync(join(checkoutDir, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('more than one live lock → refuses (ambiguous), writes nothing', async () => {
    const otherCheckout = mkdtempSync(join(tmpdir(), 'runner-checkout-2-'));
    const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { cwd: otherCheckout, stdio: 'ignore' });
    child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { cwd: checkoutDir, stdio: 'ignore' });
    try {
      await new Promise((r) => setTimeout(r, 200));
      writeLockEntry(lockRoot, 'runner-a', { owner: 'h:test:conveyor-runner', pid: child.pid, heartbeatAt: FRESH() });
      writeLockEntry(lockRoot, 'runner-b', { owner: 'h:test:conveyor-runner', pid: other.pid, heartbeatAt: FRESH() });

      const out = JSON.parse(runExpectFail(['add', '3478', '--json'], lockRoot));
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('ambiguous');
      expect(existsSync(join(checkoutDir, '.conveyor', 'queue.json'))).toBe(false);
      expect(existsSync(join(otherCheckout, '.conveyor', 'queue.json'))).toBe(false);
    } finally {
      other.kill();
      rmSync(otherCheckout, { recursive: true, force: true });
    }
  });

  it('list reports which checkout it read from, and add/remove roundtrip', async () => {
    child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { cwd: checkoutDir, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 200));
    writeLockEntry(lockRoot, 'runner', { owner: 'h:test:conveyor-runner', pid: child.pid, heartbeatAt: FRESH() });

    run(['add', '3478'], lockRoot);
    const list = JSON.parse(run(['list', '--json'], lockRoot));
    expect(list.checkout).toBe(realpathSync(checkoutDir));
    expect(list.queue.map((e) => e.num)).toEqual(['3478']);

    const removed = JSON.parse(run(['remove', '3478', '--json'], lockRoot));
    expect(removed.removed).toBe(true);
    expect(JSON.parse(readFileSync(join(checkoutDir, '.conveyor', 'queue.json'), 'utf8'))).toEqual([]);
  });
});
