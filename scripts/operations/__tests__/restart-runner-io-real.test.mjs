/**
 * @file scripts/operations/__tests__/restart-runner-io-real.test.mjs
 * @description THE REAL-MECHANISM half of `restart-runner`'s io shell (#2949's fidelity qualifier) —
 *   {@link ../restart-runner-io.mjs} exercised against a real directory tree, a real `ps` shell-out, real
 *   lock dirs on disk and a real detached child process. Its sibling
 *   {@link ./restart-runner.test.mjs} drives every DECISION through injected doubles; those stay, because
 *   they pin judgement rather than mechanics. This file exists because a double has no directory tree, no
 *   process table and no file descriptors, and this module's whole job is those three things.
 *
 * WHAT A DOUBLE CANNOT ANSWER HERE, concretely:
 *   • whether `ps -o ppid=,command= -p <pid>` parses on this platform at all (the format string is a bet);
 *   • whether `releaseLockDir` actually removes the dir `reserve` created, rather than a neighbouring path;
 *   • whether `spawn(..., {detached:true, stdio:['ignore', fd, fd]})` really lands the child's output in the
 *     file we opened — the one part of the launch a stub replaces entirely.
 *
 * ── WHAT IS DELIBERATELY *NOT* STARTED HERE ─────────────────────────────────────────────────────────────────
 *
 * THE REAL CONVEYOR SUPERVISOR AND THE REAL RUNNER ARE NEVER SPAWNED, under any case in this file or any
 * other, per a standing operator constraint. `startSupervisor` is pointed at a THROWAWAY fixture script
 * written into the test's own temp repo — five lines that print a marker and exit. That is a real
 * `child_process.spawn` with real detach and real fd wiring (which is what needs proving) and is categorically
 * not `we:skills-src/conveyor/supervisor.mjs`. Nothing here signals a process it did not itself create.
 *
 * No network, no `gh`, no `claude`, no model: the agent listing is the one seam still injected, because a real
 * one would mean launching agents.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { withRealRepo } from './helpers/real-repo.mjs';
import { reserve, readLockEntry } from '../../readiness/file-locks.mjs';
import { RUNNER_LEASE_PATH } from '../../../skills-src/conveyor/runner-lock.mjs';
import { classifyLease } from '../restart-runner.mjs';
import {
  defaultPsRead, defaultIsPidAlive, resolveTarget, sweepStaleLease, startSupervisor,
  createRestartReader, supervisorLogPath,
} from '../restart-runner-io.mjs';

const T0 = Date.UTC(2026, 8, 12, 12, 0, 0);
const MIN = 60_000;

/**
 * A REAL pid that is REALLY dead: spawn a trivial node child, wait for it to exit, hand back its pid.
 *
 * Better than a made-up large number, for two reasons. A number past the platform's pid ceiling makes `ps`
 * itself complain on stderr (`process id too large`) — noise in every run, and a different code path from the
 * one that matters. And an in-range number picked by hand could belong to something real on the machine, which
 * would make a liveness assertion flaky. A pid we created and watched die is in range, is ours, and is gone.
 */
async function reapedPid() {
  const child = spawn(process.execPath, ['-e', '0'], { stdio: 'ignore' });
  const pid = child.pid;
  await new Promise((r) => child.on('exit', r));
  return pid;
}

/** Wait for `check()` by polling, bounded — a real spawned child settles asynchronously. */
async function until(check, { timeoutMs = 10_000, stepMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (check()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

describe('defaultPsRead / defaultIsPidAlive — the REAL process table on this platform', () => {
  it('reads this very process out of `ps`, with a parseable ppid and command', () => {
    // The `-o ppid=,command=` format string is a bet about this platform's `ps`. A stub cannot lose that bet.
    const me = defaultPsRead(process.pid);
    expect(me).not.toBeNull();
    expect(Number.isFinite(me.ppid)).toBe(true);
    expect(me.command).toMatch(/node/i);
  });

  it('returns null for a pid that has really exited, rather than throwing', async () => {
    expect(defaultPsRead(await reapedPid())).toBeNull();
  });

  it('reports this process alive and a really-reaped pid dead, through the real kill(pid, 0) probe', async () => {
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(await reapedPid())).toBe(false);
  });

  it('resolveTarget walks the REAL tree and lands on this process (no supervisor above it)', () => {
    // Nothing in a vitest worker's ancestry is a `supervisor.mjs`, so the honest answer is `runner` — the
    // fallback branch, reached here through real `ps` output rather than a table literal.
    expect(resolveTarget({ pid: process.pid })).toMatchObject({ kind: 'runner', pid: process.pid });
  });

  it('resolveTarget reports `none` for a really-dead pid, through the same real read', async () => {
    expect(resolveTarget({ pid: await reapedPid() })).toMatchObject({ kind: 'none', pid: null });
  });
});

describe('the REAL lock root — a leaked lease is really removed, a live one really survives', () => {
  const plantLease = (root, { pid, heartbeatMs }) =>
    reserve(root, RUNNER_LEASE_PATH, `Mac:${pid}:conveyor-runner`, heartbeatMs, new Date(heartbeatMs).toISOString(), pid, 'unknown', 15);

  it('sweeps a real leaked lock DIR off disk (dead pid + past-TTL heartbeat), idempotently', async () => withRealRepo(async ({ root }) => {
    const lockRoot = join(root, '.locks');
    mkdirSync(lockRoot, { recursive: true });
    plantLease(lockRoot, { pid: await reapedPid(), heartbeatMs: T0 - 6 * 60 * MIN });
    expect(readLockEntry(lockRoot, RUNNER_LEASE_PATH)).not.toBeNull();

    // Real `isPidAlive`, real `isLeaseExpired`, real `releaseLockDir` — nothing injected but the clock.
    const res = sweepStaleLease({ lockRoot, nowMs: T0, classify: classifyLease });
    expect(res).toMatchObject({ swept: true, state: 'stale' });
    expect(readLockEntry(lockRoot, RUNNER_LEASE_PATH)).toBeNull();

    // …and running it again on the now-empty root is a no-op, not a second removal or a throw.
    expect(sweepStaleLease({ lockRoot, nowMs: T0, classify: classifyLease })).toMatchObject({ swept: false, state: 'none' });
  }));

  it('leaves a lease whose pid IS alive on disk, even with a heartbeat past the TTL', async () => withRealRepo(async ({ root }) => {
    const lockRoot = join(root, '.locks');
    mkdirSync(lockRoot, { recursive: true });
    // This test's OWN pid — genuinely alive, so the real liveness probe says so and the sweep must decline.
    plantLease(lockRoot, { pid: process.pid, heartbeatMs: T0 - 6 * 60 * MIN });
    expect(sweepStaleLease({ lockRoot, nowMs: T0, classify: classifyLease })).toMatchObject({ swept: false, state: 'live' });
    expect(readLockEntry(lockRoot, RUNNER_LEASE_PATH)).not.toBeNull();
  }));
});

describe('createRestartReader — against a real lock root, a real ledger file and the real process table', () => {
  it('reads a planted lease, resolves it, and counts the real ledger\'s exit rows', async () => withRealRepo(async ({ root }) => {
    const lockRoot = join(root, '.locks');
    mkdirSync(lockRoot, { recursive: true });
    reserve(lockRoot, RUNNER_LEASE_PATH, `Mac:${process.pid}:conveyor-runner`, T0, new Date(T0).toISOString(), process.pid, 'unknown', 15);
    writeFileSync(supervisorLogPath(lockRoot),
      '{"event":"spawn","attempt":1}\n{"event":"exit","attempt":1,"reason":"idle-stop"}\n{"event":"exit","attempt":2,"reason":"exit:0"}\n');

    const read = createRestartReader({ lockRoot, listAgents: () => [{ name: 'conveyor-3442', id: 'c', startedAt: T0 - 10 * MIN }] })({});

    expect(read.lease).toMatchObject({ present: true, pid: process.pid, pidAlive: true });
    expect(read.baselineExitCount).toBe(2);                 // read off the REAL file
    expect(read.target).toMatchObject({ kind: 'runner' });   // walked out of the REAL process table
    expect(read.agents[0]).toMatchObject({ buildItemNum: '3442' });
  }));

  it('reports an EMPTY lock root honestly — no lease, no target, no ledger', async () => withRealRepo(async ({ root }) => {
    const lockRoot = join(root, '.locks');
    mkdirSync(lockRoot, { recursive: true });
    const read = createRestartReader({ lockRoot, listAgents: () => [] })({});
    expect(read.lease).toMatchObject({ present: false });
    expect(read.target).toMatchObject({ kind: 'none' });
    // A missing ledger file is zero rows, NOT a throw — `readLog`'s catch is the mechanism under test here.
    expect(read.baselineExitCount).toBe(0);
  }));
});

describe('startSupervisor — a REAL detached spawn, with the child\'s output really landing in the log file', () => {
  it('spawns the given script detached, writes its stdout to <lockRoot>/supervisor.out, and does not block', async () => withRealRepo(async ({ root }) => {
    const lockRoot = join(root, '.locks');
    // NOT the conveyor supervisor — a throwaway fixture, per this file's header. It prints a marker and
    // exits, which is enough to prove the detach + fd wiring that a stub replaces wholesale.
    const fixture = join(root, 'fake-supervisor.mjs');
    writeFileSync(fixture, "process.stdout.write('FIXTURE-SUPERVISOR-UP ' + process.argv.slice(2).join(',') + '\\n');\n");

    const res = startSupervisor({ supervisorPath: fixture, cwd: root, extraArgs: ['--json'], lockRoot });

    expect(Number.isInteger(res.pid)).toBe(true);
    expect(res.logPath).toBe(join(lockRoot, 'supervisor.out'));
    // `ensureDir` really created the lock root the log lives in.
    expect(existsSync(lockRoot)).toBe(true);

    const landed = await until(() => {
      try { return readFileSync(res.logPath, 'utf8').includes('FIXTURE-SUPERVISOR-UP'); } catch { return false; }
    });
    expect(landed).toBe(true);
    // The forwarded argv really reached the child, not just the returned `argv` array.
    expect(readFileSync(res.logPath, 'utf8')).toContain('FIXTURE-SUPERVISOR-UP --json');
  }));

  it('REFUSES a path that does not exist on the real filesystem, before any spawn', async () => withRealRepo(async ({ root }) => {
    expect(() => startSupervisor({ supervisorPath: join(root, 'missing.mjs'), cwd: root, lockRoot: join(root, '.locks') }))
      .toThrow(/no supervisor at/);
    // The refusal happens before `ensureDir`, so nothing was created on the way to failing.
    expect(existsSync(join(root, '.locks'))).toBe(false);
  }));
});
