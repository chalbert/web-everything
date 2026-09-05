/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description CLI end-to-end proof of the runner-aware clear command (WE #3478). Runs the real
 *   `queue-work.mjs {add|remove}` as a subprocess with `CONVEYOR_RUNNER_LOCK_ROOT` pointed at a temp lock-dir
 *   tree and a fake `lsof` shim prepended onto `PATH`, so the whole live-runner→cwd→sidecar path runs for
 *   real with nothing touching the actual `~/.claude/conveyor-runner-locks` or a real process. Pins: (a) a
 *   live runner lock resolves to ITS checkout's sidecar, not the CLI's own script-location one; (b) no live
 *   lock → refuses (`no-live-runner`) rather than silently writing anywhere.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');

let root; // scratch root for this test: lockRoot / runnerCwd / fakeBin all live under here
let lockRoot;
let runnerCwd;
let fakeBin;

/** A fake `lsof` that always reports `runnerCwd` as the cwd for any pid — good enough to drive the CLI's
 *  `-a -p <pid> -d cwd -Fn` shell-out without a real process to point it at. */
function installFakeLsof() {
  fakeBin = join(root, 'bin');
  mkdirSync(fakeBin);
  const script = join(fakeBin, 'lsof');
  writeFileSync(script, `#!/bin/sh\nprintf 'p1\\nfcwd\\nn%s\\n' '${runnerCwd}'\n`);
  chmodSync(script, 0o755);
}

const run = (args) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CONVEYOR_RUNNER_LOCK_ROOT: lockRoot,
      PATH: `${fakeBin}:${process.env.PATH}`,
    },
  });

const lockText = (pid) => JSON.stringify({
  owner: `host:${pid}:conveyor-runner`, heartbeatAt: new Date().toISOString(), pid,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'queue-work-'));
  lockRoot = join(root, 'locks');
  runnerCwd = join(root, 'runner-checkout');
  mkdirSync(lockRoot);
  mkdirSync(runnerCwd);
  installFakeLsof();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('queue-work.mjs CLI — writes into the LIVE runner\'s checkout, not its own script location', () => {
  it('a live runner lock → add lands in that checkout\'s .conveyor/queue.json', () => {
    mkdirSync(join(lockRoot, 'runner-lease'));
    writeFileSync(join(lockRoot, 'runner-lease', 'lock.json'), lockText(1));

    const out = JSON.parse(run(['add', '3478', '--json']));
    expect(out.ok).toBe(true);
    expect(out.runnerCwd).toBe(runnerCwd);

    const sidecar = join(runnerCwd, '.conveyor', 'queue.json');
    expect(existsSync(sidecar)).toBe(true);
    expect(JSON.parse(readFileSync(sidecar, 'utf8')).map((e) => e.num)).toEqual(['3478']);
  });

  it('add is idempotent against the resolved sidecar', () => {
    mkdirSync(join(lockRoot, 'runner-lease'));
    writeFileSync(join(lockRoot, 'runner-lease', 'lock.json'), lockText(1));
    run(['add', '3478']);
    const again = JSON.parse(run(['add', '3478', '--json']));
    expect(again.already).toBe(true);
  });

  it('remove drops the id from the resolved sidecar', () => {
    mkdirSync(join(lockRoot, 'runner-lease'));
    writeFileSync(join(lockRoot, 'runner-lease', 'lock.json'), lockText(1));
    run(['add', '3478']);
    const rm = JSON.parse(run(['remove', '3478', '--json']));
    expect(rm.removed).toBe(true);
    const sidecar = join(runnerCwd, '.conveyor', 'queue.json');
    expect(JSON.parse(readFileSync(sidecar, 'utf8'))).toEqual([]);
  });

  it('no live runner lock → refuses (no-live-runner), writes nothing anywhere', () => {
    let failed = false;
    let stdout = '';
    try {
      run(['add', '3478', '--json']);
    } catch (e) {
      failed = true;
      stdout = e.stdout;
    }
    expect(failed).toBe(true);
    expect(JSON.parse(stdout)).toEqual({ ok: false, reason: 'no-live-runner' });
    expect(existsSync(join(runnerCwd, '.conveyor'))).toBe(false);
  });
});
