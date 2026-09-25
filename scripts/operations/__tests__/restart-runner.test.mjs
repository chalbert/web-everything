/**
 * @file scripts/operations/__tests__/restart-runner.test.mjs
 * @description The SAFE CONVEYOR RESTART operation (#3383) — {@link ../restart-runner.mjs} (the declaration)
 *   and {@link ../restart-runner-io.mjs} (the reader + the three sinks).
 *
 * THE THREE WAYS A RESTART HURTS, which is what every case below is really about:
 *
 *   • RESTARTING UNDER A JUST-SPAWNED BUILD AGENT ⇒ a double-dispatch, because a `conveyor-<num>` session
 *     `claude --bg` has spawned but `claude agents --json` has not yet listed has no durable floor for the
 *     fresh runner's in-flight guard to see.
 *   • STARTING BEFORE THE OLD ONE IS ACTUALLY DOWN ⇒ two runners contending, the exact thing the singleton
 *     lease exists to prevent. So the shutdown must be CONFIRMED by evidence, never by a timeout.
 *   • LEAVING A LEAKED LEASE BEHIND ⇒ the fresh runner stands down for up to 15 minutes and the supervisor
 *     scores that instant exit as a crash-loop.
 *
 * NOTHING HERE TOUCHES A REAL PROCESS OR THE REAL LOCK ROOT. No `claude` is invoked, no signal is sent, no
 * supervisor is spawned, and the machine-global `RUNNER_LOCK_ROOT` is never read or written — the reader, all
 * three sinks and the engine drive are fed stubs, and the one group that needs a real lock dir makes its own
 * under `mkdtemp`. That is a hard constraint on this suite, not a convenience: the subject signals and spawns
 * processes for a living.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { advanceWhileRunning, startRun, runStatus } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { OPERATIONS, resolveOperation } from '../run.mjs';
import { importGraph } from './import-graph.mjs';
import { reserve } from '../../readiness/file-locks.mjs';
import { RUNNER_LEASE_PATH } from '../../../skills-src/conveyor/runner-lock.mjs';
import {
  RESTART_RUNNER_OP, SHUTDOWN_EFFECT, SWEEP_LEASE_EFFECT, START_SUPERVISOR_EFFECT,
  RECENT_SPAWN_WINDOW_MS, recentBuildSpawns, classifyLease, shapeRestartRead, planRestart,
  gateStart, effectResult, restartRunnerOperation,
} from '../restart-runner.mjs';
import {
  tagAgentRow, resolveTarget, parseExitEvents, confirmShutdown, sweepStaleLease, startSupervisor,
  createRestartReader, supervisorLogPath,
} from '../restart-runner-io.mjs';

const OPS_DIR = join(process.cwd(), 'scripts', 'operations');
const T0 = Date.UTC(2026, 8, 12, 12, 0, 0);
const MIN = 60_000;

/** A reader-shaped agent row — already tagged, the way `createRestartReader` hands them to the declaration. */
const build = (name, ageMs) => ({ name, id: name.slice(0, 8), startedAt: T0 - ageMs, buildItemNum: name.replace(/\D/g, '') });
const other = (name, ageMs) => ({ name, id: name.slice(0, 8), startedAt: T0 - ageMs, buildItemNum: null });

// ── (1) the recent-spawn guard ─────────────────────────────────────────────────────────────────────────────

describe('recentBuildSpawns — only tagged build sessions, only inside the window', () => {
  it('catches a build agent spawned seconds ago', () => {
    expect(recentBuildSpawns([build('conveyor-3442', 5_000)], { nowMs: T0 }).map((h) => h.name)).toEqual(['conveyor-3442']);
  });

  it('ignores one that has aged out of the window', () => {
    expect(recentBuildSpawns([build('conveyor-3442', RECENT_SPAWN_WINDOW_MS + 1)], { nowMs: T0 })).toEqual([]);
  });

  it('ignores every untagged row — the reader already decided what counts as a build session', () => {
    expect(recentBuildSpawns([other('fix-1920', 1_000), other('review-1920', 1_000), other('prepare-3438', 1_000)], { nowMs: T0 })).toEqual([]);
  });

  it('sorts youngest first, so --wait can report the one it is actually waiting on', () => {
    const hits = recentBuildSpawns([build('conveyor-1', 50_000), build('conveyor-2', 2_000)], { nowMs: T0 });
    expect(hits.map((h) => h.name)).toEqual(['conveyor-2', 'conveyor-1']);
  });

  it('treats an unreadable startedAt as OLD, not recent — a garbage row must never wedge every restart', () => {
    expect(recentBuildSpawns([{ name: 'conveyor-9', startedAt: 'nonsense', buildItemNum: '9' }], { nowMs: T0 })).toEqual([]);
  });

  it('survives a junk listing (null rows, a non-array) without throwing', () => {
    expect(recentBuildSpawns([null, undefined, 'x'], { nowMs: T0 })).toEqual([]);
    expect(recentBuildSpawns(null, { nowMs: T0 })).toEqual([]);
  });
});

describe('tagAgentRow — the `conveyor-<num>` grammar, taken from lease-reaper and never re-derived', () => {
  it('tags a build session with its item number', () => {
    expect(tagAgentRow({ name: 'conveyor-3442', id: 'c', startedAt: 1 }).buildItemNum).toBe('3442');
  });

  it('keeps the retry-suffixed slug (`conveyor-2500b` is still a build dispatch)', () => {
    expect(tagAgentRow({ name: 'conveyor-2500b', startedAt: 1 }).buildItemNum).toBe('2500');
  });

  it('leaves the OTHER session kinds untagged — fix/review/prepare re-derive their own state, builds do not', () => {
    for (const n of ['fix-1920', 'review-1920', 'prepare-3438', 'prepare-decision-3438']) {
      expect(tagAgentRow({ name: n, startedAt: 1 }).buildItemNum).toBeNull();
    }
  });

  it('leaves a name outside the slug grammar untagged (no second, looser matcher — #3283)', () => {
    // `probe1` / `Mac:24827` are the exact shapes #3283 records aliasing onto real item numbers under a
    // sloppier `(\d+)$` match; `conveyor-x9ylkp7` is a hash-identified item, which yields null by design.
    for (const n of ['probe1', 'Mac:24827', 'conveyor-x9ylkp7', '']) {
      expect(tagAgentRow({ name: n, startedAt: 1 }).buildItemNum).toBeNull();
    }
  });
});

// ── (2) the lease decision ─────────────────────────────────────────────────────────────────────────────────

describe('classifyLease — `stale` needs a past-TTL heartbeat AND a dead pid, both', () => {
  const raw = (over) => ({
    present: true, pid: 4242, owner: 'Mac:4242:conveyor-runner',
    heartbeatAt: new Date(T0).toISOString(), expired: false, pidAlive: true, ...over,
  });

  it('no lease ⇒ none', () => {
    expect(classifyLease(null)).toMatchObject({ state: 'none' });
    expect(classifyLease({ present: false })).toMatchObject({ state: 'none' });
  });

  it('fresh heartbeat + live pid ⇒ live', () => {
    expect(classifyLease(raw())).toMatchObject({ state: 'live' });
  });

  it('past-TTL heartbeat but the pid is STILL ALIVE ⇒ live, never swept', () => {
    // The runner wedged inside a long blocking mechanical pass. Reaping its lease would hand the singleton
    // right to a second runner while the first is still driving — the double-dispatch the lease prevents.
    expect(classifyLease(raw({ expired: true, pidAlive: true }))).toMatchObject({ state: 'live', expired: true });
  });

  it('dead pid but a FRESH heartbeat ⇒ live, never swept (pids get reused; one signal is not proof)', () => {
    expect(classifyLease(raw({ expired: false, pidAlive: false }))).toMatchObject({ state: 'live', pidAlive: false });
  });

  it('past-TTL heartbeat AND a dead pid ⇒ stale — the leaked shape found live on the dev machine', () => {
    expect(classifyLease(raw({ pid: 85594, expired: true, pidAlive: false })))
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

  it('reports `none` for a pid already gone (nothing to signal)', () => {
    expect(resolveTarget({ pid: 500, psRead: () => null })).toMatchObject({ kind: 'none', pid: null });
    expect(resolveTarget({ pid: null })).toMatchObject({ kind: 'none' });
  });
});

// ── (4) confirming the shutdown by EVIDENCE, not a timeout ─────────────────────────────────────────────────

describe('confirmShutdown — evidence, never a timeout', () => {
  const noSleep = async () => {};
  const heldLease = () => ({ owner: 'X', pid: 500, heartbeatAt: new Date(T0).toISOString() });

  it('confirms via the runner\'s OWN exit event, carrying its reason through', async () => {
    // Exactly the row `supervisor.mjs` writes after `classifyExit` reads `{event:'stopped', stoppedReason}`
    // off the runner's stdout. Note the lease is STILL on disk and the pid STILL alive below: the event alone
    // is sufficient evidence, which is the point of preferring it.
    const log = '{"event":"spawn","attempt":1}\n'
      + '{"event":"exit","attempt":1,"code":0,"signal":null,"kind":"clean","reason":"idle-stop","shutdownRequested":true}\n';
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, nowMs: () => T0,
      readLease: heldLease, readLog: () => log, isPidAlive: () => true,
    });
    expect(res).toMatchObject({ confirmed: true, via: 'exit-event', reason: 'idle-stop' });
  });

  it('does NOT mistake a PRE-EXISTING exit row for this restart\'s confirmation (the baseline count)', async () => {
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 1, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 10),
      readLease: heldLease, readLog: () => '{"event":"exit","attempt":1,"kind":"clean","reason":"exit:0"}\n', isPidAlive: () => true,
    });
    expect(res.confirmed).toBe(false);
  });

  it('falls back to lease-gone + pid-dead when there is no supervisor ledger at all (a bare runner)', async () => {
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, nowMs: () => T0,
      readLease: () => null, readLog: () => '', isPidAlive: () => false,
    });
    expect(res).toMatchObject({ confirmed: true, via: 'lease-and-pid', leaseGone: true, pidAlive: false });
  });

  it('is NOT satisfied by the pid dying alone while the lease is still on disk — that IS the leak', async () => {
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 10),
      readLease: heldLease, readLog: () => '', isPidAlive: () => false,
    });
    expect(res).toMatchObject({ confirmed: false, leaseGone: false, pidAlive: false });
  });

  it('reports what it DID see when it gives up, rather than throwing a bare timeout', async () => {
    let ticks = 0;
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, timeoutMs: 1,
      nowMs: () => T0 + (ticks++ === 0 ? 0 : 5_000),
      readLease: heldLease, readLog: () => '', isPidAlive: () => true,
    });
    expect(res).toMatchObject({ confirmed: false, via: null, leaseGone: false, pidAlive: true });
    expect(res.waitedMs).toBe(5_000);
  });

  it('terminates on a FROZEN clock via the poll ceiling instead of spinning forever', async () => {
    // The deadline is computed from the INJECTED clock, so a clock that never advances would otherwise be an
    // infinite tight loop with no diagnosis. A first cut of this suite did exactly that.
    const res = await confirmShutdown({
      pid: 500, baselineExitCount: 0, sleep: noSleep, timeoutMs: 10, pollMs: 5, nowMs: () => T0,
      readLease: heldLease, readLog: () => '', isPidAlive: () => true,
    });
    expect(res.confirmed).toBe(false);
  });

  it('skips a malformed ledger line instead of dying on it (a live process is appending to it)', () => {
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
    const res = sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false, classify: classifyLease });
    expect(res).toMatchObject({ swept: true, state: 'stale' });
    expect(res.detail).toMatch(/pid 85594 is dead/);
    // Proven by the real filesystem: a second sweep finds nothing left.
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false, classify: classifyLease }))
      .toMatchObject({ swept: false, state: 'none' });
  }));

  it('leaves a LIVE lease alone and explains why', () => withRoot((root) => {
    plant(root, { pid: 4242, heartbeatMs: T0 - 1 * MIN });
    const res = sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => true, classify: classifyLease });
    expect(res).toMatchObject({ swept: false, state: 'live' });
    expect(res.detail).toMatch(/BOTH a past-TTL heartbeat and a dead pid/);
  }));

  it('leaves an EXPIRED-but-still-running lease alone (the wedged-in-a-long-pass case)', () => withRoot((root) => {
    plant(root, { pid: 4242, heartbeatMs: T0 - 30 * MIN });
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => true, classify: classifyLease }))
      .toMatchObject({ swept: false, state: 'live' });
  }));

  it('is a no-op on an empty lock root', () => withRoot((root) => {
    expect(sweepStaleLease({ lockRoot: root, nowMs: T0, isPidAlive: () => false, classify: classifyLease }))
      .toMatchObject({ swept: false, state: 'none' });
  }));

  it('refuses without the declaration\'s `classifyLease` — the lease rule has exactly one implementation', () => {
    expect(() => sweepStaleLease({ lockRoot: '/nope' })).toThrow(/classifyLease/);
  });
});

// ── (6) the launch ─────────────────────────────────────────────────────────────────────────────────────────

describe('startSupervisor — detached, unref\'d, output on disk', () => {
  const spy = () => {
    const calls = [];
    return { calls, spawn: (exe, argv, opts) => { calls.push({ exe, argv, opts }); return { pid: 909, unref() { calls.push({ unref: true }); } }; } };
  };

  it('spawns node with the supervisor path, detached, stdio to one log file under the lock root', () => {
    const s = spy();
    const res = startSupervisor({
      supervisorPath: '/repo/skills-src/conveyor/supervisor.mjs', cwd: '/repo', extraArgs: ['--repo=o/r'],
      lockRoot: '/locks', ensureDir: () => {}, openLog: () => 7, exists: () => true, spawn: s.spawn,
    });
    expect(res).toMatchObject({ pid: 909, logPath: join('/locks', 'supervisor.out') });
    expect(s.calls[0].argv).toEqual(['/repo/skills-src/conveyor/supervisor.mjs', '--repo=o/r']);
    expect(s.calls[0].opts).toMatchObject({ detached: true, stdio: ['ignore', 7, 7] });
    // unref'd, or this operation could never exit without taking the conveyor down with it.
    expect(s.calls.at(-1)).toEqual({ unref: true });
  });

  it('REFUSES a supervisor path that does not exist, instead of reporting a pid for nothing', () => {
    // A detached child that fails to start reports nothing back, so without this check a typo'd path prints
    // "started supervisor pid N" and leaves nothing running at all.
    const s = spy();
    expect(() => startSupervisor({ supervisorPath: '/nope.mjs', exists: () => false, spawn: s.spawn })).toThrow(/no supervisor at/);
    expect(s.calls).toEqual([]);
  });
});

// ── (7) the reader ─────────────────────────────────────────────────────────────────────────────────────────

describe('createRestartReader — observes; decides nothing', () => {
  const baseIo = {
    lockRoot: '/locks', readLease: () => null, readLog: () => '', isPidAlive: () => false,
    psRead: () => null, sleepSync: () => {}, now: () => T0,
  };

  it('tags every listing row and reports the observation time', () => {
    const read = createRestartReader({ ...baseIo, listAgents: () => [{ name: 'conveyor-7', id: 'a', startedAt: T0 - 1000 }] })({});
    expect(read.agents[0]).toMatchObject({ name: 'conveyor-7', buildItemNum: '7' });
    expect(read.observedAtMs).toBe(T0);
  });

  it('carries an unreadable listing as a FACT rather than throwing (the plan turns it into a refusal)', () => {
    const read = createRestartReader({ ...baseIo, listAgents: () => { throw new Error('claude: command not found'); } })({});
    expect(read).toMatchObject({ listingReadable: false, agents: [] });
    expect(read.listingError).toMatch(/command not found/);
  });

  it('resolves the lease into expired/pidAlive facts and walks `ps` to the signal target', () => {
    const entry = { owner: 'Mac:500:conveyor-runner', pid: 500, heartbeatAt: new Date(T0 - 30 * MIN).toISOString() };
    const read = createRestartReader({
      ...baseIo, listAgents: () => [], readLease: () => entry,
      psRead: (pid) => (pid === 500 ? { ppid: 400, command: 'node runner.mjs' } : { ppid: 1, command: 'node supervisor.mjs' }),
    })({});
    expect(read.lease).toMatchObject({ present: true, pid: 500, expired: true, pidAlive: false });
    expect(read.target).toMatchObject({ kind: 'supervisor', pid: 400 });
  });

  it('counts the ledger\'s exit rows BEFORE anything is signalled', () => {
    const read = createRestartReader({
      ...baseIo, listAgents: () => [],
      readLog: () => '{"event":"exit"}\n{"event":"spawn"}\n{"event":"exit"}\n',
    })({});
    expect(read.baselineExitCount).toBe(2);
  });

  it('--wait polls until the listing goes quiet, and reports how long it waited', () => {
    let nowMs = T0;
    let polls = 0;
    const read = createRestartReader({
      ...baseIo,
      now: () => nowMs,
      // Hot for the first two polls, then the agent ages out of the window.
      listAgents: () => { polls += 1; return [{ name: 'conveyor-3442', id: 'c', startedAt: polls <= 2 ? nowMs - 1_000 : nowMs - 5 * MIN }]; },
      sleepSync: () => { nowMs += 1_000; },
    })({ wait: true, windowMs: RECENT_SPAWN_WINDOW_MS, waitTimeoutMs: 60_000, pollMs: 1_000 });
    expect(polls).toBe(3);
    expect(read.waitedMs).toBe(2_000);
  });

  it('--wait gives up at its deadline rather than polling forever', () => {
    let nowMs = T0;
    const read = createRestartReader({
      ...baseIo,
      now: () => nowMs,
      listAgents: () => [{ name: 'conveyor-3442', id: 'c', startedAt: nowMs - 1_000 }],   // always fresh
      sleepSync: () => { nowMs += 4_000; },
    })({ wait: true, waitTimeoutMs: 10_000, pollMs: 4_000 });
    expect(read.waitedMs).toBeGreaterThanOrEqual(10_000);
    expect(read.agents.length).toBe(1);       // still hot — the PLAN is what refuses, not the reader
  });

  it('does NOT keep polling an unreadable listing — waiting cannot make it readable', () => {
    let calls = 0;
    createRestartReader({ ...baseIo, listAgents: () => { calls += 1; throw new Error('nope'); } })({ wait: true });
    expect(calls).toBe(1);
  });
});

// ── (8) the verdict ────────────────────────────────────────────────────────────────────────────────────────

describe('planRestart — the refusals, and what each one says', () => {
  const read = (over = {}) => shapeRestartRead({ observedAtMs: T0, agents: [], lease: { present: false }, ...over });

  it('proceeds on a quiet board', () => {
    expect(planRestart({ read: read({ agents: [build('conveyor-3442', 10 * MIN)] }) }))
      .toMatchObject({ proceed: true, guard: 'passed', refusal: null });
  });

  it('REFUSES on a just-spawned build agent, naming it and its age', () => {
    const plan = planRestart({ read: read({ agents: [build('conveyor-3442', 8_000)] }) });
    expect(plan).toMatchObject({ proceed: false, guard: 'recent-spawn' });
    expect(plan.refusal).toMatch(/conveyor-3442 \(8s ago\)/);
    expect(plan.refusal).toMatch(/double-dispatch/);
    expect(plan.refusal).toMatch(/--wait/);
  });

  it('tells a --wait caller that waiting already happened, instead of suggesting it again', () => {
    const plan = planRestart({ read: read({ agents: [build('conveyor-3442', 8_000)], waitedMs: 300_000 }), waited: true });
    expect(plan.refusal).toMatch(/--wait gave up after 300s/);
  });

  it('FAILS CLOSED on an unreadable listing — an unevaluable guard is not a passed guard', () => {
    const plan = planRestart({ read: read({ listingReadable: false, listingError: 'claude: command not found' }) });
    expect(plan).toMatchObject({ proceed: false, guard: 'listing-unreadable' });
    expect(plan.refusal).toMatch(/could not read `claude agents --json`/);
  });

  it('--force passes BOTH refusals, and marks the verdict so nobody mistakes it for a clean guard', () => {
    const hot = read({ agents: [build('conveyor-3442', 1_000)], listingReadable: false });
    expect(planRestart({ read: hot, force: true })).toMatchObject({ proceed: true, guard: 'skipped', guardSkipped: true });
  });

  it('carries the target onto the verdict, where the effect steps read it', () => {
    const plan = planRestart({ read: read({ target: { kind: 'supervisor', pid: 400, command: 'node supervisor.mjs' } }) });
    expect(plan.target).toMatchObject({ kind: 'supervisor', pid: 400 });
  });
});

// ── (9) the gate ───────────────────────────────────────────────────────────────────────────────────────────

describe('gateStart — the last chance to decline to make things worse', () => {
  const okPlan = { proceed: true, refusal: null };

  it('clears a plain start (nothing was running, nothing to sweep)', () => {
    expect(gateStart({ plan: okPlan, shutdown: null, sweep: { state: 'none' } })).toMatchObject({ starting: true });
  });

  it('never starts behind a refused plan', () => {
    expect(gateStart({ plan: { proceed: false, refusal: 'nope' } })).toMatchObject({ starting: false, reason: 'nope' });
  });

  it('REFUSES after an unconfirmed shutdown — starting now would race a process that may still be driving', () => {
    const g = gateStart({
      plan: okPlan,
      shutdown: { attempted: true, confirmed: false, pid: 400, leaseGone: false, pidAlive: true, waitedMs: 90_000 },
    });
    expect(g.starting).toBe(false);
    expect(g.reason).toMatch(/never confirmed after 90s/);
    expect(g.reason).toMatch(/lease STILL HELD/);
  });

  it('REFUSES while a LIVE lease survives the sweep — a fresh runner would just stand down', () => {
    const g = gateStart({ plan: okPlan, shutdown: null, sweep: { state: 'live', detail: 'held by someone' } });
    expect(g.starting).toBe(false);
    expect(g.reason).toMatch(/LIVE lease is still held/);
  });

  it('a NOT-attempted shutdown is not an unconfirmed one — that is the plain-start path', () => {
    expect(gateStart({ plan: okPlan, shutdown: null, sweep: { state: 'stale' } })).toMatchObject({ starting: true });
  });
});

describe('effectResult — unwraps the ENGINE\'s effect finding, not the sink\'s raw return', () => {
  it('returns the one applied result', () => {
    expect(effectResult({ applied: true, effects: [{ type: 'x', status: 'applied', result: { ok: 1 } }] })).toEqual({ ok: 1 });
  });

  it('a zero-effect step is `null` — "not attempted", never "failed"', () => {
    expect(effectResult({ applied: true, effects: [] })).toBeNull();
    expect(effectResult(null)).toBeNull();
  });

  it('an effect that did NOT land yields null rather than a stale result', () => {
    expect(effectResult({ applied: false, effects: [{ type: 'x', status: 'failed', result: { ok: 1 }, error: 'boom' }] })).toBeNull();
  });
});

// ── (10) the declaration, end to end through the real engine ───────────────────────────────────────────────

/** Drive a run to completion, applying every pending effect through `sinks`. The operation has THREE effect
 *  steps, so this loops rather than doing a single apply/advance pair. */
async function driveAll({ registry, sinks, input = {}, id = 'run-rr' }) {
  const store = createMemoryRunStore();
  let run = advanceWhileRunning(startRun({ op: RESTART_RUNNER_OP, id, input, registry }), { registry });
  // `status` is DERIVED, never stored on the record (`engine.mjs#runStatus`) — so this asks the engine rather
  // than reading a field that does not exist. The bound is a guard against a declaration that never settles,
  // not an expected count: three effect steps settle in at most three passes.
  for (let i = 0; i < 10 && runStatus(run, { registry }) === 'awaiting-effect'; i += 1) {
    ({ run } = await applyPendingEffects(run, { registry, sinks, store }));
    run = advanceWhileRunning(run, { registry });
  }
  return run;
}

describe('the restart-runner declaration — read → plan → stop → sweep → gate → start', () => {
  /** A registry holding the declaration, fed one canned reader observation. */
  const registryFor = (observation) => {
    const registry = createRegistry();
    registry.register(restartRunnerOperation({ readRestartFacts: () => observation }));
    return registry;
  };

  const quiet = (over = {}) => ({
    observedAtMs: T0, waitedMs: 0, listingReadable: true, listingError: null, agents: [],
    lease: { present: true, pid: 500, owner: 'Mac:500:conveyor-runner', heartbeatAt: new Date(T0).toISOString(), expired: false, pidAlive: true },
    target: { kind: 'supervisor', pid: 400, command: 'node supervisor.mjs' },
    baselineExitCount: 0,
    ...over,
  });

  const sinksFor = (state) => ({
    [SHUTDOWN_EFFECT]: async (payload) => { state.signalled.push(payload); return state.shutdown; },
    [SWEEP_LEASE_EFFECT]: async () => state.sweep,
    [START_SUPERVISOR_EFFECT]: async (payload) => { state.started.push(payload); return { pid: 909, logPath: '/locks/supervisor.out' }; },
  });

  const freshState = (over = {}) => ({
    signalled: [], started: [],
    shutdown: { attempted: true, confirmed: true, via: 'exit-event', reason: 'signal:SIGTERM', pid: 400, targetKind: 'supervisor', leaseGone: true, pidAlive: false, waitedMs: 120 },
    sweep: { swept: false, state: 'none', detail: 'no lease on disk — nothing to sweep' },
    ...over,
  });

  it('HAPPY PATH: signals the SUPERVISOR, confirms, sweeps nothing, starts exactly one supervisor', async () => {
    const state = freshState();
    const run = await driveAll({ registry: registryFor(quiet()), sinks: sinksFor(state) });
    expect(runStatus(run, { registry: registryFor(quiet()) })).toBe('complete');
    expect(run.verdict).toMatchObject({ proceed: true, guard: 'passed' });
    // pid 400 — the SUPERVISOR, not the runner child the lease names.
    expect(state.signalled).toEqual([{ pid: 400, targetKind: 'supervisor', baselineExitCount: 0, pollMs: 500 }]);
    expect(state.started.length).toBe(1);
    expect(run.findings.gate).toMatchObject({ starting: true });
  });

  it('REFUSES on a just-spawned build agent — NOTHING is signalled and NOTHING is started', async () => {
    const state = freshState();
    const run = await driveAll({ registry: registryFor(quiet({ agents: [build('conveyor-3442', 5_000)] })), sinks: sinksFor(state) });
    expect(runStatus(run, { registry: registryFor(quiet()) })).toBe('complete');
    expect(run.verdict.proceed).toBe(false);
    expect(state.signalled).toEqual([]);
    expect(state.started).toEqual([]);
    expect(run.findings.gate.reason).toMatch(/conveyor-3442/);
  });

  it('FAILS CLOSED on an unreadable listing — still nothing signalled, nothing started', async () => {
    const state = freshState();
    const run = await driveAll({
      registry: registryFor(quiet({ listingReadable: false, listingError: 'claude: command not found' })),
      sinks: sinksFor(state),
    });
    expect(run.verdict.guard).toBe('listing-unreadable');
    expect(state.signalled).toEqual([]);
    expect(state.started).toEqual([]);
  });

  it('--force skips the guard and starts even with a hot listing, marking the verdict', async () => {
    const state = freshState();
    const run = await driveAll({
      registry: registryFor(quiet({ agents: [build('conveyor-3442', 1_000)] })),
      sinks: sinksFor(state), input: { force: true },
    });
    expect(run.verdict).toMatchObject({ proceed: true, guardSkipped: true });
    expect(state.started.length).toBe(1);
  });

  it('REFUSES TO START when the shutdown is never confirmed — the two-runners race this prevents', async () => {
    const state = freshState({
      shutdown: { attempted: true, confirmed: false, pid: 400, targetKind: 'supervisor', leaseGone: false, pidAlive: true, waitedMs: 90_000 },
    });
    const run = await driveAll({ registry: registryFor(quiet()), sinks: sinksFor(state) });
    expect(state.signalled.length).toBe(1);          // it DID try
    expect(state.started).toEqual([]);               // …and then declined to start a second one
    expect(run.findings.gate.reason).toMatch(/never confirmed/);
  });

  it('REFUSES TO START while a LIVE lease survives the sweep', async () => {
    const state = freshState({ sweep: { swept: false, state: 'live', detail: 'held by Mac:777:conveyor-runner' } });
    const run = await driveAll({ registry: registryFor(quiet()), sinks: sinksFor(state) });
    expect(state.started).toEqual([]);
    expect(run.findings.gate.reason).toMatch(/LIVE lease is still held/);
  });

  it('SWEEPS a leaked lease left by a dead runner, then starts', async () => {
    const state = freshState({ sweep: { swept: true, state: 'stale', detail: 'swept a LEAKED lease: pid 85594 is dead' } });
    const run = await driveAll({
      // Nothing to signal: the lease names a pid `ps` no longer knows.
      registry: registryFor(quiet({
        lease: { present: true, pid: 85594, owner: 'Mac:85594:conveyor-runner', heartbeatAt: new Date(T0 - 6 * 60 * MIN).toISOString(), expired: true, pidAlive: false },
        target: { kind: 'none', pid: null, command: null },
      })),
      sinks: sinksFor(state),
    });
    expect(state.signalled).toEqual([]);            // no live process to stop
    expect(state.started.length).toBe(1);           // …but the leaked lock is gone, so a fresh one can drive
    expect(run.findings.gate).toMatchObject({ starting: true });
  });

  it('degenerates to a plain START when nothing is running and no lease exists', async () => {
    const state = freshState();
    const run = await driveAll({
      registry: registryFor(quiet({ lease: { present: false }, target: { kind: 'none', pid: null, command: null } })),
      sinks: sinksFor(state),
    });
    expect(state.signalled).toEqual([]);
    expect(state.started.length).toBe(1);
    expect(runStatus(run, { registry: registryFor(quiet()) })).toBe('complete');
  });

  it('forwards `checkout`/`supervisor` to the launch effect, so a caller can point it at another tree', async () => {
    const state = freshState();
    await driveAll({
      registry: registryFor(quiet()), sinks: sinksFor(state),
      input: { checkout: '/elsewhere', supervisor: '/elsewhere/supervisor.mjs' },
    });
    expect(state.started[0]).toEqual({ checkout: '/elsewhere', supervisor: '/elsewhere/supervisor.mjs' });
  });

  it('refuses to build without an injected reader — the io is never defaulted into the declaration', () => {
    expect(() => restartRunnerOperation({})).toThrow(/readRestartFacts/);
  });

  it('declares no `cwd` input — that name is a CONTROL flag and would be unreachable from argv', () => {
    const decl = restartRunnerOperation({ readRestartFacts: () => quiet() });
    expect(Object.keys(decl.input)).toContain('checkout');
    expect(Object.keys(decl.input)).not.toContain('cwd');
  });
});

// ── (11) registration ──────────────────────────────────────────────────────────────────────────────────────

describe('restart-runner is a DECLARED operation, not a plain module', () => {
  it('is in the OPERATIONS table — an unregistered declaration is the defect `gate-health` shipped with', () => {
    expect(Object.keys(OPERATIONS)).toContain(RESTART_RUNNER_OP);
    expect(resolveOperation(RESTART_RUNNER_OP).declaration.name).toBe(RESTART_RUNNER_OP);
  });

  it('binds a sink for every effect type it declares — an effect with no sink refuses the whole step', () => {
    expect(Object.keys(resolveOperation(RESTART_RUNNER_OP).sinks).sort())
      .toEqual([SHUTDOWN_EFFECT, SWEEP_LEASE_EFFECT, START_SUPERVISOR_EFFECT].sort());
  });

  it('the DECLARATION module reaches nothing that can act — no `node:` specifier, no package', () => {
    // The property that matters most in this tree: this operation's verbs are SIGNAL A PROCESS and SPAWN ONE,
    // so "the killer lives in the io shell" must be a graph fact rather than a claim in a comment.
    expect(importGraph(join(OPS_DIR, 'restart-runner.mjs')).external).toEqual([]);
  });

  it('the declaration does not reach its own io shell', () => {
    const reached = importGraph(join(OPS_DIR, 'restart-runner.mjs')).files.map((f) => f.split('/').pop());
    expect(reached).not.toContain('restart-runner-io.mjs');
  });
});

describe('supervisorLogPath — the ledger this operation reads is the one the supervisor writes', () => {
  it('is `<lockRoot>/supervisor-history.jsonl`, matching supervisor.mjs#DEFAULT_LOG_PATH', () => {
    expect(supervisorLogPath('/locks')).toBe(join('/locks', 'supervisor-history.jsonl'));
  });

  it('the real supervisor module still spells it that way (a rename there must break this test, not prod)', () => {
    // The io shell re-derives this path instead of importing the supervisor module, which would drag its whole
    // dependency tree in for one string. That is only safe if a rename on the other side is CAUGHT.
    expect(readFileSync(join(process.cwd(), 'skills-src', 'conveyor', 'supervisor.mjs'), 'utf8'))
      .toContain("'supervisor-history.jsonl'");
  });
});
