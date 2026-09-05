/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description CLI proof of WE #3478: `queue-work.mjs` resolves the LIVE runner's checkout (via a real
 *   `lsof -p <pid> -d cwd` probe against a genuinely running child process) and writes into THAT checkout's
 *   sidecar — never the caller's own cwd or script location, and never silently when no live runner (or more
 *   than one) is found. `CONVEYOR_RUNNER_LOCK_ROOT` points the CLI at a temp lock root so the real machine's
 *   own runner lease (if any) can never interfere.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');

let lockRoot;
let runnerCheckout;
let child; // a real, genuinely-alive process — its actual cwd is what the CLI must resolve to

const runnerEntry = (pid, minutesAgo) => ({
  owner: `test-host:${pid}:conveyor-runner`, pid, heartbeatAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});
const writeLock = (id, entry) => {
  mkdirSync(join(lockRoot, id), { recursive: true });
  writeFileSync(join(lockRoot, id, 'lock.json'), JSON.stringify(entry));
};
const run = (args, env = {}) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot, ...env },
  });

beforeAll(() => {
  // `lsof` resolves the REAL path (macOS's temp dirs symlink `/var` → `/private/var`) — realpath it up front
  // so assertions compare like-for-like with what the CLI actually resolves.
  runnerCheckout = realpathSync(mkdtempSync(join(tmpdir(), 'runner-checkout-')));
  // A real, long-lived child rooted at `runnerCheckout` — `lsof -p <its pid> -d cwd` genuinely resolves here.
  child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: runnerCheckout, stdio: 'ignore' });
});
afterAll(() => {
  child.kill();
  rmSync(runnerCheckout, { recursive: true, force: true });
});
beforeEach(() => {
  lockRoot = mkdtempSync(join(tmpdir(), 'runner-locks-'));
  rmSync(join(runnerCheckout, '.conveyor'), { recursive: true, force: true }); // fresh sidecar per test
});
afterEach(() => rmSync(lockRoot, { recursive: true, force: true }));

describe('queue-work.mjs CLI — writes into the LIVE runner’s resolved checkout', () => {
  it('a) a live lock naming a real pid → queues into that pid’s ACTUAL cwd, not this CLI’s own checkout', () => {
    writeLock('live', runnerEntry(child.pid, 1));
    const out = JSON.parse(run(['add', '3478', '--json']));
    expect(out.ok).toBe(true);
    expect(out.checkoutRoot).toBe(runnerCheckout);
    const sidecar = join(runnerCheckout, '.conveyor', 'queue.json');
    expect(existsSync(sidecar)).toBe(true);
    expect(JSON.parse(readFileSync(sidecar, 'utf8')).map((e) => e.num)).toEqual(['3478']);
  });

  it('b) no live lock at all → refuses (non-zero exit), writes nothing anywhere', () => {
    expect(() => run(['add', '3478'])).toThrow();
    let err;
    try { run(['add', '3478', '--json']); } catch (e) { err = e; }
    const payload = JSON.parse(err.stdout || err.stderr);
    expect(payload.ok).toBe(false);
    expect(payload.reason).toBe('no-live-runner');
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('b) only a STALE lock (crashed runner) → same refusal as no lock at all', () => {
    writeLock('dead', runnerEntry(999999, 60)); // heartbeat an hour old — well past the lease
    let err;
    try { run(['add', '3478', '--json']); } catch (e) { err = e; }
    expect(JSON.parse(err.stdout || err.stderr).reason).toBe('no-live-runner');
  });

  it('c) two live locks → ambiguity refusal, never guesses one of them', () => {
    writeLock('live-a', runnerEntry(child.pid, 1));
    writeLock('live-b', runnerEntry(child.pid + 1, 1));
    let err;
    try { run(['add', '3478', '--json']); } catch (e) { err = e; }
    const payload = JSON.parse(err.stdout || err.stderr);
    expect(payload.ok).toBe(false);
    expect(payload.reason).toBe('ambiguous');
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('reports back which checkout it queued into (the whole point of #3478)', () => {
    writeLock('live', runnerEntry(child.pid, 1));
    const out = JSON.parse(run(['add', '9999', '--json']));
    expect(out.checkoutRoot).toBe(runnerCheckout);
    expect(out.pid).toBe(child.pid);
  });

  it('list reads back the resolved checkout’s sidecar', () => {
    writeLock('live', runnerEntry(child.pid, 1));
    run(['add', '3478']);
    const list = JSON.parse(run(['list', '--json']));
    expect(list.queue.map((e) => e.num)).toEqual(['3478']);
    expect(list.checkoutRoot).toBe(runnerCheckout);
  });
});
