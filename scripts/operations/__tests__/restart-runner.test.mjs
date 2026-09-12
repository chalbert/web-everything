/**
 * @file scripts/operations/__tests__/restart-runner.test.mjs
 * @description Unit proof of the SAFE CONVEYOR RESTART operation
 *   ({@link ../restart-runner.mjs}) — the four-step sequence a restart has to get right, and the three ways
 *   getting it wrong actually hurt:
 *
 *   • RESTARTING UNDER A JUST-SPAWNED BUILD AGENT ⇒ a double-dispatch, because a `conveyor-<num>` session
 *     `claude --bg` has spawned but `claude agents --json` has not yet listed has no durable floor for the
 *     fresh runner's in-flight guard to see.
 *   • STARTING BEFORE THE OLD ONE IS ACTUALLY DOWN ⇒ two runners contending, the exact thing the singleton
 *     lease exists to prevent. So the shutdown must be CONFIRMED by evidence, never by a timeout.
 *   • LEAVING A LEAKED LEASE BEHIND ⇒ the fresh runner stands down for up to 15 minutes and the supervisor
 *     scores that instant exit as a crash-loop.
 *
 * Every decision in the operation is a pure function over facts someone else read, so all of this is driven
 * with plain objects, injected clocks and injected signals: no process is spawned, no signal is sent, no
 * `claude` is invoked, and the real machine-global lock root is never touched.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserve } from '../../readiness/file-locks.mjs';
import { RUNNER_LEASE_PATH } from '../../../skills-src/conveyor/runner-lock.mjs';
import {
  RECENT_SPAWN_WINDOW_MS, recentBuildSpawns, classifyLease, planRestart, resolveTarget,
  parseExitEvents, confirmShutdown, sweepStaleLease, startSupervisor, restartRunner, supervisorLogPath,
} from '../restart-runner.mjs';

const T0 = Date.UTC(2026, 8, 12, 12, 0, 0);
const MIN = 60_000;
const agent = (name, ageMs, extra = {}) => ({ name, id: name.slice(0, 8), startedAt: T0 - ageMs, ...extra });

// ── (1) the recent-spawn guard ─────────────────────────────────────────────────────────────────────────────

describe('recentBuildSpawns — only `conveyor-<num>`, only inside the window', () => {
  it('catches a build agent spawned seconds ago', () => {
    const hits = recentBuildSpawns([agent('conveyor-3442', 5_000)], { nowMs: T0 });
    expect(hits.map((h) => h.name)).toEqual(['conveyor-3442']);
  });

  it('ignores one that has aged out of the window', () => {
    expect(recentBuildSpawns([agent('conveyor-3442', RECENT_SPAWN_WINDOW_MS + 1)], { nowMs: T0 })).toEqual([]);
  });

  it('ignores the OTHER session kinds — fix/review/prepare re-derive their own state, builds do not', () => {
    const agents = [agent('fix-1920', 1_000), agent('review-1920', 1_000), agent('prepare-3438', 1_000), agent('prepare-decision-3438', 1_000)];
    expect(recentBuildSpawns(agents, { nowMs: T0 })).toEqual([]);
  });

  it('ignores a name that is not the conveyor slug grammar at all (no second, looser matcher — #3283)', () => {
    // `probe1`/`Mac:24827` are the exact shapes #3283 records aliasing onto real item numbers under a
    // sloppier `(\d+)$` match. They must not read as build agents here either.
    expect(recentBuildSpawns([agent('probe1', 1_000), agent('Mac:24827', 1_000), agent('conveyor-x9ylkp7', 1_000)], { nowMs: T0 })).toEqual([]);
  });

  it('keeps the retry-suffixed slug (`conveyor-2500b` is still a build dispatch)', () => {
    expect(recentBuildSpawns([agent('conveyor-2500b', 1_000)], { nowMs: T0 }).map((h) => h.name)).toEqual(['conveyor-2500b']);
  });

  it('sorts youngest first, so a --wait caller can report the one it is actually waiting on', () => {
    const hits = recentBuildSpawns([agent('conveyor-1', 50_000), agent('conveyor-2', 2_000)], { nowMs: T0 });
    expect(hits.map((h) => h.name)).toEqual(['conveyor-2', 'conveyor-1']);
  });

  it('treats an unreadable startedAt as OLD, not recent — a garbage row must never wedge every restart', () => {
    expect(recentBuildSpawns([{ name: 'conveyor-9', startedAt: 'nonsense' }], { nowMs: T0 })).toEqual([]);
  });

  it('survives a junk listing (null rows, a non-array) without throwing', () => {
    expect(recentBuildSpawns([null, undefined, 'x'], { nowMs: T0 })).toEqual([]);
    expect(recentBuildSpawns(null, { nowMs: T0 })).toEqual([]);
  });
});

describe('planRestart — a just-spawned build agent is a REFUSAL, and it says which one', () => {
  it('refuses, naming the agent and its age', () => {
    const plan = planRestart({ agents: [agent('conveyor-3442', 8_000)], nowMs: T0 });
    expect(plan.proceed).toBe(false);
    expect(plan.refusal).toMatch(/REFUSING/);
    expect(plan.refusal).toMatch(/conveyor-3442 \(8s ago\)/);
    expect(plan.refusal).toMatch(/double-dispatch/);
  });

  it('proceeds on a quiet board', () => {
    expect(planRestart({ agents: [agent('conveyor-3442', 10 * MIN)], nowMs: T0 })).toMatchObject({ proceed: true, refusal: null });
  });
});

// ── (2) the lease classification the whole thing hangs on ──────────────────────────────────────────────────

describe('classifyLease — `stale` needs a past-TTL heartbeat AND a dead pid, both', () => {
  const entry = (ageMs, pid = 4242) => ({ owner: `Mac:${pid}:conveyor-runner`, pid, heartbeatAt: new Date(T0 - ageMs).toISOString() });

  it('no lease ⇒ none', () => {
    expect(classifyLease(null, { nowMs: T0 })).toMatchObject({ state: 'none' });
  });

  it('fresh heartbeat + live pid ⇒ live', () => {
    expect(classifyLease(entry(1 * MIN), { nowMs: T0, isPidAlive: () => true })).toMatchObject({ state: 'live' });
  });

  it('past-TTL heartbeat but the pid is STILL ALIVE ⇒ live, never swept', () => {
    // The runner wedged inside a long blocking mechanical pass. Reaping its lease would hand the singleton
    // right to a second runner while the first is still driving — the double-dispatch the lease prevents.
    expect(classifyLease(entry(30 * MIN), { nowMs: T0, isPidAlive: () => true })).toMatchObject({ state: 'live', expired: true, pidAlive: true });
  });

  it('dead pid but a FRESH heartbeat ⇒ live, never swept (pids get reused; one signal is not proof)', () => {
    expect(classifyLease(entry(1 * MIN), { nowMs: T0, isPidAlive: () => false })).toMatchObject({ state: 'live', expired: false, pidAlive: false });
  });

  it('past-TTL heartbeat AND a dead pid ⇒ stale — the leaked-lease shape found live on the dev machine', () => {
    expect(classifyLease(entry(6 * 60 * MIN, 85594), { nowMs: T0, isPidAlive: () => false }))
      .toMatchObject({ state: 'stale', pid: 85594, expired: true, pidAlive: false });
  });
});

// ── (3) who gets the signal ────────────────────────────────────────────────────────────────────────────────

describe('resolveTarget — signal the SUPERVISOR when one is resident, never just its runner child', () => {
  const ps = (table) => (pid) => table[pid] ?? null;

  it('walks up to the supervisor parent', () => {
    const table = {
      500: { ppid: 400, command: 'node /repo/skills-src/conveyor/runner.mjs --json' },
      400: { ppid: 1, command: 'node /repo/skills-src/conveyor/supervisor.mjs --json' },
    };
    expect(resolveTarget({ pid: 500, psRead: ps(table) })).toMatchObject({ kind: 'supervisor', pid: 400 });
  });

  it('falls back to the bare runner when its parent is NOT a supervisor', () => {
    const table = { 500: { ppid: 400, command: 'node runner.mjs' }, 400: { ppid: 1, command: '-bash' } };
    expect(resolveTarget({ pid: 500, psRead: ps(table) })).toMatchObject({ kind: 'runner', pid: 500 });
  });

  it('reports `none` for a pid that is already gone (nothing to signal)', () => {
    expect(resolveTarget({ pid: 500, psRead: () => null })).toMatchObject({ kind: 'none', pid: null });
    expect(resolveTarget({ pid: null })).toMatchObject({ kind: 'none' });
  });
});

// ── (4) confirming the shutdown by EVIDENCE, not a timeout ─────────────────────────────────────────────────

describe('confirmShutdown — evidence, never a timeout', () => {
  const noSleep = async () => {};

  it('confirms via the runner\'s OWN exit event, carrying its reason through to the caller', async () => {
    // Exactly the row `supervisor.mjs` writes after `classifyExit` reads `{event:'stopped', stoppedReason}`
    // off the runner's stdout — the durable transcription of that stdout line. Note the lease below is STILL
    // on disk and the pid STILL alive: the event alone is sufficient evidence, which is the point.
    const log = '{"event":"spawn","attempt":1}\n'
      + '{"event":"exit","attempt":1,"code":0,"signal":null,"kind":"clean","reason":"idle-stop","shutdownRequested":true}\n';
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, nowMs: () => T0,
      readLease: () => ({ owner: 'X', pid: 500, heartbeatAt: new Date(T0).toISOString() }),
      readLog: () => log, isPidAlive: () => true,
    });
    expect(res).toMatchObject({ confirmed: true, via: 'exit-event', reason: 'idle-stop' });
  });

  it('does NOT mistake a PRE-EXISTING exit row for this restart\'s confirmation (the baseline count)', async () => {
    const log = '{"event":"exit","attempt":1,"kind":"clean","reason":"exit:0"}\n';
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 1, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 10),     // one poll, then past the deadline
      readLease: () => ({ owner: 'X', pid: 500, heartbeatAt: new Date(T0).toISOString() }),
      readLog: () => log, isPidAlive: () => true,
    });
    expect(res.confirmed).toBe(false);   // the old row was already counted; nothing new arrived
  });

  it('falls back to lease-gone + pid-dead when there is no supervisor ledger at all (a bare runner)', async () => {
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, nowMs: () => T0,
      readLease: () => null, readLog: () => '', isPidAlive: () => false,
    });
    expect(res).toMatchObject({ confirmed: true, via: 'lease-and-pid', leaseGone: true, pidAlive: false });
  });

  it('is NOT satisfied by the pid dying alone while the lease is still on disk (that IS the leak)', async () => {
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 10),
      readLease: () => ({ owner: 'X', pid: 500, heartbeatAt: new Date(T0).toISOString() }),
      readLog: () => '', isPidAlive: () => false,
    });
    expect(res).toMatchObject({ confirmed: false, leaseGone: false, pidAlive: false });
  });

  it('reports what it DID see when it gives up, rather than throwing a bare timeout', async () => {
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 5_000),
      readLease: () => ({ owner: 'X', pid: 500, heartbeatAt: new Date(T0).toISOString() }),
      readLog: () => '', isPidAlive: () => true,
    });
    expect(res).toMatchObject({ confirmed: false, via: null, leaseGone: false, pidAlive: true });
    expect(res.waitedMs).toBe(5_000);
  });

  it('skips a malformed ledger line instead of dying on it (the file is appended to by a live process)', () => {
    expect(parseExitEvents('{"event":"exit","reason":"a"}\n{not json\n{"event":"spawn"}\n{"event":"exit","reason":"b"}')
      .map((e) => e.reason)).toEqual(['a', 'b']);
  });
});

// ── (5) the stale-lease sweep, against a REAL lock root ────────────────────────────────────────────────────

describe('sweepStaleLease — removes a leaked lease, and ONLY a leaked one', () => {
  const withRoot = (fn) => {
    const root = mkdtempSync(join(tmpdir(), 'restart-sweep-'));
    try { return fn(root); } finally { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } }
  };
  /** Plant a REAL lock dir through the real `reserve`, so the sweep runs against the real on-disk shape. */
  const plant = (root, { pid, heartbeatMs }) =>
    reserve(root, RUNNER_LEASE_PATH, `Mac:${pid}:conveyor-runner`, heartbeatMs, new Date(heartbeatMs).toISOString(), pid, 'unknown', 15);

  it('sweeps the real leaked-lease shape (dead pid, heartbeat hours old)', () => withRoot((root) => {
    plant(root, { pid: 85594, heartbeatMs: T0 - 6 * 60 * MIN });
    const res = sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false });
    expect(res).toMatchObject({ swept: true, state: 'stale' });
    expect(res.detail).toMatch(/pid 85594 is dead/);
    // Proven by the real filesystem, not by the injected release stub.
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false })).toMatchObject({ swept: false, state: 'none' });
  }));

  it('leaves a LIVE lease alone and explains why', () => withRoot((root) => {
    plant(root, { pid: 4242, heartbeatMs: T0 - 1 * MIN });
    const res = sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => true });
    expect(res).toMatchObject({ swept: false, state: 'live' });
    expect(res.detail).toMatch(/BOTH a past-TTL heartbeat and a dead pid/);
  }));

  it('leaves an EXPIRED-but-still-running lease alone (the wedged-in-a-long-pass case)', () => withRoot((root) => {
    plant(root, { pid: 4242, heartbeatMs: T0 - 30 * MIN });
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => true })).toMatchObject({ swept: false, state: 'live' });
  }));

  it('is a no-op on an empty lock root', () => withRoot((root) => {
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false })).toMatchObject({ swept: false, state: 'none' });
  }));
});

// ── (6) the launch ─────────────────────────────────────────────────────────────────────────────────────────

describe('startSupervisor — detached, unref\'d, output on disk', () => {
  it('spawns node with the supervisor path, detached, stdio to one log file under the lock root', () => {
    const calls = [];
    const res = startSupervisor({
      supervisorPath: '/repo/skills-src/conveyor/supervisor.mjs', cwd: '/repo', extraArgs: ['--repo=o/r'],
      lockRoot: '/locks', ensureDir: () => {}, openLog: () => 7,
      spawn: (exe, argv, opts) => { calls.push({ exe, argv, opts }); return { pid: 909, unref() { calls.push({ unref: true }); } }; },
    });
    expect(res).toMatchObject({ pid: 909, logPath: '/locks/supervisor.out' });
    expect(calls[0].argv).toEqual(['/repo/skills-src/conveyor/supervisor.mjs', '--repo=o/r']);
    expect(calls[0].opts).toMatchObject({ cwd: '/repo', detached: true, stdio: ['ignore', 7, 7] });
    // unref'd, or this operation could never exit without taking the conveyor down with it.
    expect(calls.at(-1)).toEqual({ unref: true });
  });

  it('refuses without a supervisor path rather than spawning something undefined', () => {
    expect(() => startSupervisor({})).toThrow(/supervisorPath/);
  });
});

// ── (7) the composition, end to end over injected effects ──────────────────────────────────────────────────

describe('restartRunner — the four steps in order, and every way it declines to start a second one', () => {
  const liveLease = { owner: 'Mac:500:conveyor-runner', pid: 500, heartbeatAt: new Date(T0).toISOString() };
  const supervisorPs = { 500: { ppid: 400, command: 'node runner.mjs' }, 400: { ppid: 1, command: 'node supervisor.mjs --json' } };

  /** The happy path's effects: a quiet board, a live supervisor, and a shutdown that lands an exit row. */
  const happy = (over = {}) => {
    const state = { leaseGone: false, pidAlive: true, log: '{"event":"spawn","attempt":1}\n', signals: [], spawns: [] };
    return {
      state,
      opts: {
        supervisorPath: '/repo/supervisor.mjs', cwd: '/repo', lockRoot: '/locks', pollMs: 0, now: () => T0,
        listAgents: () => [agent('conveyor-3442', 10 * MIN)],
        readLease: () => (state.leaseGone ? null : liveLease),
        readLog: () => state.log,
        isPidAlive: () => state.pidAlive,
        psRead: (pid) => supervisorPs[pid] ?? null,
        signal: (pid, sig) => {
          state.signals.push([pid, sig]);
          state.leaseGone = true; state.pidAlive = false;
          state.log += '{"event":"exit","attempt":1,"code":0,"signal":"SIGTERM","kind":"crash","reason":"signal:SIGTERM","shutdownRequested":true}\n';
        },
        spawn: (exe, argv, o) => { state.spawns.push({ exe, argv, o }); return { pid: 909, unref() {} }; },
        ensureDir: () => {}, openLog: () => 7,
        sleep: async () => {},
        ...over,
      },
    };
  };

  it('HAPPY PATH: guard passes → SIGTERM the SUPERVISOR → confirmed by the exit event → nothing to sweep → start', async () => {
    const h = happy();
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(true);
    expect(h.state.signals).toEqual([[400, 'SIGTERM']]);          // the SUPERVISOR, not the runner child
    expect(res.shutdown).toMatchObject({ confirmed: true, via: 'exit-event', reason: 'signal:SIGTERM' });
    expect(res.sweep).toMatchObject({ swept: false, state: 'none' });
    expect(res.started).toMatchObject({ pid: 909 });
    expect(res.steps.join('\n')).toMatch(/1\. recent-spawn guard PASSED[\s\S]*2\. SIGTERM → supervisor pid 400[\s\S]*shutdown CONFIRMED[\s\S]*3\.[\s\S]*4\. started supervisor pid 909/);
  });

  it('REFUSES on a just-spawned build agent, and starts NOTHING', async () => {
    const h = happy({ listAgents: () => [agent('conveyor-3442', 5_000)] });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(false);
    expect(res.refusal).toMatch(/conveyor-3442 \(5s ago\)/);
    expect(h.state.signals).toEqual([]);   // never signalled
    expect(h.state.spawns).toEqual([]);    // never started
  });

  it('--wait polls until the recent spawn ages out, then proceeds', async () => {
    let nowMs = T0;
    const spawnedAt = T0 - 55_000;
    const h = happy({
      wait: true,
      now: () => nowMs,
      listAgents: () => [{ name: 'conveyor-3442', id: 'c', startedAt: spawnedAt }],
      sleep: async () => { nowMs += 3_000; },   // each poll advances the clock past the window
    });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(true);
    expect(res.steps.some((s) => /waiting — youngest build agent is \d+s old/.test(s))).toBe(true);
  });

  it('--wait GIVES UP (still refusing, still starting nothing) when dispatch never quiets down', async () => {
    let nowMs = T0;
    const h = happy({
      wait: true, waitTimeoutMs: 10_000, now: () => nowMs,
      listAgents: () => [{ name: 'conveyor-3442', id: 'c', startedAt: nowMs - 1_000 }],  // always fresh
      sleep: async () => { nowMs += 4_000; },
    });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(false);
    expect(res.refusal).toMatch(/--wait gave up/);
    expect(h.state.spawns).toEqual([]);
  });

  it('--force skips the guard, and SAYS SO on the report rather than hiding it', async () => {
    const h = happy({ force: true, listAgents: () => [agent('conveyor-3442', 1_000)] });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(true);
    expect(res.steps[0]).toMatch(/guard SKIPPED \(--force\)/);
  });

  it('FAILS CLOSED when the agent listing cannot be read — an unevaluable guard is not a passed guard', async () => {
    const h = happy({ listAgents: () => { throw new Error('claude: command not found'); } });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(false);
    expect(res.refusal).toMatch(/could not read `claude agents --json`/);
    expect(h.state.spawns).toEqual([]);
  });

  it('REFUSES TO START when the shutdown is never confirmed — the two-runners race this exists to prevent', async () => {
    const h = happy({
      shutdownTimeoutMs: 1,
      signal: () => { /* the process ignores it: lease stays, pid stays alive */ },
      now: (() => { let n = 0; return () => T0 + (n++ < 2 ? 0 : 10_000); })(),
    });
    const res = await restartRunner(h.opts);
    expect(res.ok).toBe(false);
    expect(res.refusal).toMatch(/shutdown was never confirmed/);
    expect(res.refusal).toMatch(/lease STILL HELD/);
    expect(h.state.spawns).toEqual([]);
  });

  it('SWEEPS a leaked lease left by an older runner, then starts', async () => {
    // Nothing is running (no pid to signal), but a stale lock dir is still on disk — the case where a restart
    // would otherwise sit stood-down for the full TTL against a lock nothing alive will ever release.
    const leaked = { owner: 'Mac:85594:conveyor-runner', pid: 85594, heartbeatAt: new Date(T0 - 6 * 60 * MIN).toISOString() };
    let gone = false;
    const spawns = [];
    const res = await restartRunner({
      supervisorPath: '/repo/supervisor.mjs', lockRoot: '/locks', pollMs: 0, now: () => T0,
      listAgents: () => [],
      readLease: () => (gone ? null : leaked),
      readLog: () => '',
      isPidAlive: () => false,
      psRead: () => null,                                    // pid 85594 is gone
      signal: () => { throw new Error('must not signal a dead pid'); },
      spawn: (exe, argv) => { spawns.push(argv); return { pid: 909, unref() {} }; },
      ensureDir: () => {}, openLog: () => 7,
      sleep: async () => {},
      // The sweep's own release, injected so this case needs no temp dir; the REAL on-disk removal is proven
      // against a real lock root in the sweepStaleLease block above.
      release: () => { gone = true; },
    });
    expect(res.ok).toBe(true);
    expect(res.steps.some((s) => /nothing to stop — the lease names pid 85594, which is already gone/.test(s))).toBe(true);
    expect(spawns.length).toBe(1);
  });

  it('REFUSES TO START while a LIVE lease survives the sweep — a fresh runner would just stand down', async () => {
    // The one we signalled goes down cleanly (a new exit row lands), but some OTHER runner has meanwhile taken
    // the lease. Confirmation succeeds; the sweep then finds a lease that is live and not ours to remove.
    const spawns = [];
    let log = '';
    const res = await restartRunner({
      supervisorPath: '/repo/supervisor.mjs', lockRoot: '/locks', pollMs: 0, now: () => T0,
      listAgents: () => [],
      readLease: () => ({ owner: 'Mac:777:conveyor-runner', pid: 777, heartbeatAt: new Date(T0).toISOString() }),
      readLog: () => log,
      isPidAlive: (pid) => pid === 777,
      psRead: (pid) => (pid === 777 ? { ppid: 1, command: 'node runner.mjs' } : null),
      signal: () => { log += '{"event":"exit","kind":"clean","reason":"exit:0"}\n'; },
      spawn: (exe, argv) => { spawns.push(argv); return { pid: 909, unref() {} }; },
      ensureDir: () => {}, openLog: () => 7,
      sleep: async () => {},
    });
    expect(res.shutdown).toMatchObject({ confirmed: true, via: 'exit-event' });
    expect(res.ok).toBe(false);
    expect(res.refusal).toMatch(/LIVE lease is still held/);
    expect(spawns).toEqual([]);
  });

  it('degenerates to a plain START when nothing is running and no lease exists', async () => {
    const spawns = [];
    const res = await restartRunner({
      supervisorPath: '/repo/supervisor.mjs', lockRoot: '/locks', pollMs: 0, now: () => T0,
      listAgents: () => [], readLease: () => null, readLog: () => '', isPidAlive: () => false,
      psRead: () => null, signal: () => { throw new Error('nothing to signal'); },
      spawn: (exe, argv) => { spawns.push(argv); return { pid: 909, unref() {} }; },
      ensureDir: () => {}, openLog: () => 7,
      sleep: async () => {},
    });
    expect(res.ok).toBe(true);
    expect(res.steps.some((s) => /nothing to stop — no singleton lease on disk/.test(s))).toBe(true);
    expect(spawns.length).toBe(1);
  });
});

// ── (8) the paths this operation hard-codes ────────────────────────────────────────────────────────────────

describe('supervisorLogPath — the ledger this operation reads is the one the supervisor writes', () => {
  it('is `<lockRoot>/supervisor-history.jsonl`, matching supervisor.mjs#DEFAULT_LOG_PATH', () => {
    expect(supervisorLogPath('/locks')).toBe(join('/locks', 'supervisor-history.jsonl'));
  });

  it('the real supervisor module still spells it that way (a rename there must break this test, not prod)', () => {
    // This operation re-derives the ledger path instead of importing the supervisor module (which would drag
    // its whole dependency tree in for one string). That is only safe if a rename on the other side is
    // CAUGHT — so assert against the real file rather than trusting the two to stay in step.
    const src = readFileSync(join(process.cwd(), 'skills-src', 'conveyor', 'supervisor.mjs'), 'utf8');
    expect(src).toContain("'supervisor-history.jsonl'");
  });
});
