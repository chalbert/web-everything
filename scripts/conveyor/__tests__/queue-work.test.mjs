/**
 * @file scripts/conveyor/__tests__/queue-work.test.mjs
 * @description CLI proof of the runner-aware clear-for-build command (WE #3478) — the fix for the incident
 *   where `queue.mjs add` reported success while writing into a checkout the live runner never reads. Runs
 *   the real `queue-work.mjs` as a subprocess against a fixture runner-lock root (`CONVEYOR_RUNNER_LOCK_ROOT`)
 *   and fake `lsof`/`ps` shims on `PATH` (so the pid→cwd resolution AND the pid-reuse identity guard are
 *   exercised without depending on a real, live process or a host's actual `lsof`/`ps` binaries), asserting
 *   the write lands in the RESOLVED runner checkout — never wherever the CLI happens to be invoked from.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync, existsSync, readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reserve } from '../../readiness/file-locks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'queue-work.mjs');

let dir, lockRoot, fakeBin, runnerCheckout;

// A fake `lsof` shim on PATH: for `-a -p <pid> -d cwd -Fn`, prints the canned cwd this test wants resolved —
// so pid liveness/real `lsof` availability never gates the assertion.
function writeFakeLsof(cwd) {
  const script = `#!/usr/bin/env node\nprocess.stdout.write('p1\\nn${cwd}\\n');\n`;
  const path = join(fakeBin, 'lsof');
  writeFileSync(path, script, 'utf8');
  chmodSync(path, 0o755);
}

// A fake `ps` shim on PATH answering the pid-reuse identity guard's `-o command= -p <pid>` — defaults to
// naming the runner script (verifies true); pass a different command line to simulate a reused pid.
function writeFakePs(commandLine = 'node skills-src/conveyor/runner.mjs --json') {
  const script = `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(commandLine)} + '\\n');\n`;
  const path = join(fakeBin, 'ps');
  writeFileSync(path, script, 'utf8');
  chmodSync(path, 0o755);
}

const run = (args, extraEnv = {}) =>
  execFileSync('node', [CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      CONVEYOR_RUNNER_LOCK_ROOT: lockRoot,
      ...extraEnv,
    },
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'queue-work-'));
  lockRoot = join(dir, 'locks');
  fakeBin = join(dir, 'bin');
  runnerCheckout = join(dir, 'the-runners-checkout');
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(runnerCheckout, { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('queue-work.mjs — (a) a live, cwd-resolvable runner lock → queues into THAT checkout', () => {
  it('add writes the sidecar under the resolved runner checkout, not the CLI\'s own cwd', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 4242);
    writeFakeLsof(runnerCheckout);
    writeFakePs();

    const out = JSON.parse(run(['add', '3478', '--json']));
    expect(out.ok).toBe(true);
    expect(out.checkout).toBe(runnerCheckout);

    const sidecar = join(runnerCheckout, '.conveyor', 'queue.json');
    expect(existsSync(sidecar)).toBe(true);
    expect(JSON.parse(readFileSync(sidecar, 'utf8')).map((e) => e.num)).toEqual(['3478']);
  });

  it('remove un-clears from the resolved checkout\'s sidecar', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 4242);
    writeFakeLsof(runnerCheckout);
    writeFakePs();

    run(['add', '3478']);
    const out = JSON.parse(run(['remove', '3478', '--json']));
    expect(out.removed).toBe(true);
    const sidecar = join(runnerCheckout, '.conveyor', 'queue.json');
    expect(JSON.parse(readFileSync(sidecar, 'utf8'))).toEqual([]);
  });
});

describe('queue-work.mjs — (b) no live runner lock → refuses, never guesses a checkout', () => {
  it('an empty lock root exits non-zero and writes nothing', () => {
    writeFakeLsof(runnerCheckout);
    let threw = false;
    try { run(['add', '3478', '--json']); } catch (e) { threw = true; expect(e.status).not.toBe(0); }
    expect(threw).toBe(true);
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('a STALE lock (heartbeat far in the past) also refuses — a crashed runner is not live', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'DEAD', Date.now(), new Date(0).toISOString(), 111);
    writeFakeLsof(runnerCheckout);
    expect(() => run(['add', '3478'])).toThrow();
  });

  it('a live lock with pid 0 (no-pid) refuses and writes nothing (#3478 review, round 1)', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 0);
    writeFakeLsof(runnerCheckout);
    expect(() => run(['add', '3478'])).toThrow();
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });

  it('a live lock whose pid resolves to no cwd (cwd-unresolved) refuses and writes nothing', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 4242);
    writeFileSync(join(fakeBin, 'lsof'), '#!/usr/bin/env node\nprocess.exit(1);\n', 'utf8');
    chmodSync(join(fakeBin, 'lsof'), 0o755);
    expect(() => run(['add', '3478'])).toThrow();
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });
});

describe('queue-work.mjs — (c) more than one live lock → refuses on ambiguity', () => {
  it('two live locks exit non-zero and write nothing', () => {
    reserve(lockRoot, '<lease-one>', 'A', Date.now(), new Date().toISOString(), 111);
    reserve(lockRoot, '<lease-two>', 'B', Date.now(), new Date().toISOString(), 222);
    writeFakeLsof(runnerCheckout);
    expect(() => run(['add', '3478'])).toThrow();
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });
});

describe('queue-work.mjs — a caller sitting in a DIFFERENT checkout never gets a false success', () => {
  it('the CLI\'s own cwd is untouched — only the resolved runner checkout gets the sidecar', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 4242);
    writeFakeLsof(runnerCheckout);
    writeFakePs();
    const callerCwd = join(dir, 'an-unrelated-caller-checkout');
    mkdirSync(callerCwd, { recursive: true });

    execFileSync('node', [CLI, 'add', '3478'], {
      cwd: callerCwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, CONVEYOR_RUNNER_LOCK_ROOT: lockRoot },
    });

    expect(existsSync(join(callerCwd, '.conveyor', 'queue.json'))).toBe(false);
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(true);
  });
});

describe('queue-work.mjs — (d) a resolved pid whose process does not verify as the runner → refuses (pid-reuse guard, #3478 review)', () => {
  it('a fake `ps` naming an unrelated process exits non-zero and writes nothing', () => {
    reserve(lockRoot, '<conveyor:runner-singleton-lease>', 'RUNNER', Date.now(), new Date().toISOString(), 4242);
    writeFakeLsof(runnerCheckout);
    writeFakePs('node some-unrelated-script.mjs');
    expect(() => run(['add', '3478'])).toThrow();
    expect(existsSync(join(runnerCheckout, '.conveyor', 'queue.json'))).toBe(false);
  });
});
