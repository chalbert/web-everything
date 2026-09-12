/**
 * @file skills-src/conveyor/__tests__/runner.test.mjs
 * @description Unit proof of the conveyor HEADLESS RUNNER (WE #2702, epic #2677(b), the DELEGATE half) — the
 *   SINGLETON-LOCKED, no-LLM runner that drives the mechanized tick core. Two subjects, both driven with plain
 *   objects / a REAL temp lock root (never the machine-global home dir) and an injected clock — no git/network,
 *   no LLM, no real lease:
 *
 *   • the SINGLETON LOCK ({@link ../runner-lock.mjs}) — the #2701 build-condition-2 sole-driver right: a second
 *     runner NO-OPS on a live lease, a STALE lease is reclaimable, heartbeat/release fence on ownership;
 *   • the RUNNER'S CONTROL FLOW ({@link ../runner.mjs} pure core) — it threads the core's `nextState` forward
 *     UNCHANGED (the thin-shell invariant: it never re-derives a guard), surfaces every tick's decisions,
 *     stops on the core's idle-stop and on the tick budget, and stops when its singleton lease is lost.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { readLockEntry } from '../../../scripts/readiness/file-locks.mjs';
import {
  RUNNER_LEASE_PATH,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned, runnerLeaseStatus,
} from '../runner-lock.mjs';
import {
  carryForward, shouldStop, tickSurface, runLoop, driveConveyor, DEFAULT_TICK_INTERVAL_MS,
  summarizeMechanicalPassError, MECHANICAL_PASS_ERROR_LOG_CHARS, makeCliMechanicalPasses,
  bookkeepingForDispatch, installShutdownHandlers, finalEventLine, SHUTDOWN_SIGNALS,
} from '../runner.mjs';

// Hoisted mock — `makeCliMechanicalPasses` dynamically `import('node:child_process')`s `execFileSync`
// (§below, x5v8yy9 review finding), so the module itself must be mocked rather than the binding. Keeps every
// other real export (via `importOriginal`) — several modules this test file pulls in transitively (e.g.
// `scripts/lib/output-mix.mjs`) import `node:child_process` themselves and need its real shape.
// #xu2pp2m — `spawn` IS MOCKED TOO, because the review-dispatch call moved onto it. `review-dispatch.mjs` is
// now a BLOCKING mechanical review rather than a fork-and-return `claude --bg` spawn, so the runner runs it
// through `runQuietHeartbeating` — which must use `spawn`, since `execFileSync` blocks the event loop and no
// heartbeat timer could fire during a multi-minute pass. A test mocking only `execFileSync` therefore stopped
// seeing the dispatch at all.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFileSync: vi.fn(), spawn: vi.fn() };
});

/**
 * A `spawn` stand-in for the heartbeating passes: records the argv into the SAME list the `execFileSync`
 * router uses (so assertions read one list), then resolves with `exitCodeFor(joinedArgs)`. Shaped the way
 * `runQuietHeartbeating` actually consumes a child — `.stderr.on('data')`, `.on('error')`, `.on('exit')`.
 */
function makeSpawnRouter(calls, exitCodeFor = () => 0) {
  return (cmd, args) => {
    calls.push([cmd, ...args]);
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    // Asynchronously, so the caller has attached its listeners before the exit lands.
    setImmediate(() => child.emit('exit', exitCodeFor(args.join(' '))));
    return child;
  };
}

const T0 = Date.parse('2026-07-27T12:00:00.000Z');
const MIN = 60_000;

// ── (1) the singleton lock — sole-driver right (#2701 build condition 2) ────────────────────────────────────

describe('runner singleton lease — two runners never both drive', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'runner-lock-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  it('the first runner wins the lease; a SECOND live launch NO-OPS (held)', () => {
    const a = acquireRunnerLease(root, 'A', { nowMs: T0 });
    expect(a).toMatchObject({ ok: true });
    // B launches while A's lease is fresh → blocked, told who holds it, so B stands down instead of driving.
    const b = acquireRunnerLease(root, 'B', { nowMs: T0 + 1000, leaseMinutes: 15 });
    expect(b.ok).toBe(false);
    expect(b.heldBy).toBe('A');
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('A'); // A still owns it — B never stomped
  });

  it('a STALE lease (a crashed runner) is RECLAIMABLE via the TTL', () => {
    acquireRunnerLease(root, 'DEAD', { nowMs: T0, leaseMinutes: 15 });
    // 16 min later the heartbeat is older than the 15-min lease → a fresh runner reclaims it.
    const fresh = acquireRunnerLease(root, 'FRESH', { nowMs: T0 + 16 * MIN, leaseMinutes: 15 });
    expect(fresh.ok).toBe(true);
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('FRESH');
  });

  it('heartbeat extends an OWNED lease and is a no-op once reclaimed away', () => {
    acquireRunnerLease(root, 'A', { nowMs: T0, leaseMinutes: 15 });
    expect(heartbeatRunnerLease(root, 'A', { nowMs: T0 + 1 * MIN })).toBe(true);
    // Another runner reclaims A's now-stale lease; A's later heartbeat must NOT resurrect its ownership.
    acquireRunnerLease(root, 'B', { nowMs: T0 + 20 * MIN, leaseMinutes: 15 });
    expect(heartbeatRunnerLease(root, 'A', { nowMs: T0 + 21 * MIN })).toBe(false);
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('B');
  });

  it('release fences on ownership — a reclaimed owner never stomps the new holder', () => {
    acquireRunnerLease(root, 'A', { nowMs: T0, leaseMinutes: 15 });
    acquireRunnerLease(root, 'B', { nowMs: T0 + 20 * MIN, leaseMinutes: 15 }); // B reclaims A's stale lease
    expect(releaseRunnerLeaseIfOwned(root, 'A')).toBe(false);                   // A's late release is a no-op
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('B');             // B's lease intact
    expect(releaseRunnerLeaseIfOwned(root, 'B')).toBe(true);                    // the true owner releases
    expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull();
  });

  it('runnerLeaseStatus reports held / stale / absent', () => {
    expect(runnerLeaseStatus(root, { nowMs: T0 })).toMatchObject({ held: false, stale: false, owner: null });
    acquireRunnerLease(root, 'A', { nowMs: T0, leaseMinutes: 15 });
    expect(runnerLeaseStatus(root, { nowMs: T0 + 1 * MIN, leaseMinutes: 15 })).toMatchObject({ held: true, stale: false, owner: 'A' });
    expect(runnerLeaseStatus(root, { nowMs: T0 + 16 * MIN, leaseMinutes: 15 })).toMatchObject({ held: false, stale: true, owner: 'A' });
  });
});

// ── (2) the runner's pure control flow — thin shell over the core ───────────────────────────────────────────

describe('carryForward — threads the core nextState UNCHANGED (never re-derives a guard)', () => {
  it('carries nextState verbatim into the next tick payload', () => {
    const nextState = { tick: 4, buildGuards: [{ num: 7, lane: 2, spawnedTick: 3 }], watched: [{ pr: 9 }] };
    const payload = carryForward({ nextState });
    expect(payload.bookkeeping).toBe(nextState);   // SAME object — no copy, no mutation, no re-derivation
    expect(payload.signals).toEqual({});
  });
  it('defaults to empty bookkeeping when the core returned no nextState', () => {
    expect(carryForward({}).bookkeeping).toEqual({});
    expect(carryForward(null).bookkeeping).toEqual({});
  });
  it('passes through only observed signals the runner may add', () => {
    const payload = carryForward({ nextState: { tick: 1 } }, { signals: { returnedBuildNums: [5] } });
    expect(payload.signals).toEqual({ returnedBuildNums: [5] });
  });
});

describe('bookkeepingForDispatch (#3416) — strips ONLY the target item\'s own guard, nothing else', () => {
  it('removes the target item\'s own entry from every guard list', () => {
    const nextState = {
      tick: 2,
      buildGuards: [{ num: '3412', lane: 1, spawnedTick: 0 }, { num: '99', lane: 5, spawnedTick: 0 }],
      prepareGuards: [{ num: '3412', kind: 'prepare', lane: 1, spawnedTick: 0 }],
      fixGuards: [{ num: '3412', lane: 2, spawnedTick: 0 }],
      ciHealGuards: [{ num: '3412', lane: 3, spawnedTick: 0 }],
      watched: [{ pr: 9 }],
    };
    const bookkeeping = bookkeepingForDispatch(nextState, { num: '3412' });
    // THE REGRESSION THIS GUARDS: before the fix, dispatch-lane's own nested tick-core read would see this
    // exact entry already live for the item it is about to dispatch, and refuse — "suppressed by the
    // in-flight build guard" — against a guard the SAME tick just planned, never a real spawn.
    expect(bookkeeping.buildGuards).toEqual([{ num: '99', lane: 5, spawnedTick: 0 }]);
    expect(bookkeeping.prepareGuards).toEqual([]);
    expect(bookkeeping.fixGuards).toEqual([]);
    expect(bookkeeping.ciHealGuards).toEqual([]);
  });
  it('leaves every OTHER item\'s guard untouched — a genuinely in-flight item still suppresses', () => {
    const nextState = {
      buildGuards: [{ num: '10', lane: 1, spawnedTick: 0 }, { num: '20', lane: 2, spawnedTick: 0 }],
    };
    const bookkeeping = bookkeepingForDispatch(nextState, { num: '10' });
    expect(bookkeeping.buildGuards).toEqual([{ num: '20', lane: 2, spawnedTick: 0 }]);
  });
  it('normalizes the num the same way the guard lists themselves are normalized (string vs number)', () => {
    const nextState = { buildGuards: [{ num: 3412, lane: 1, spawnedTick: 0 }] };
    expect(bookkeepingForDispatch(nextState, { num: '3412' }).buildGuards).toEqual([]);
  });
  it('tolerates a missing guard list on either side — no throw, nothing invented', () => {
    expect(bookkeepingForDispatch({ tick: 1 }, { num: '3412' })).toEqual({
      tick: 1, buildGuards: undefined, prepareGuards: undefined, fixGuards: undefined, ciHealGuards: undefined,
    });
  });
  it('leaves every other field on nextState (tick, watched, fixAttempts, …) exactly as it was', () => {
    const nextState = { tick: 5, watched: [{ pr: 1 }], fixAttempts: { 7: 2 }, buildGuards: [{ num: '3412', lane: 1 }] };
    const bookkeeping = bookkeepingForDispatch(nextState, { num: '3412' });
    expect(bookkeeping.tick).toBe(5);
    expect(bookkeeping.watched).toBe(nextState.watched);
    expect(bookkeeping.fixAttempts).toBe(nextState.fixAttempts);
  });
});

describe('shouldStop — the two mechanical stop conditions, both from the core', () => {
  it('stops on the core idle-stop', () => {
    expect(shouldStop({ decisions: { idleStop: true } }, { tick: 0, maxTicks: Infinity })).toEqual({ stop: true, reason: 'idle-stop' });
  });
  it('stops when the tick budget is spent (--once ⇒ maxTicks 1)', () => {
    expect(shouldStop({ decisions: { idleStop: false } }, { tick: 0, maxTicks: 1 })).toEqual({ stop: true, reason: 'max-ticks' });
  });
  it('keeps going while neither condition holds', () => {
    expect(shouldStop({ decisions: { idleStop: false } }, { tick: 0, maxTicks: Infinity })).toEqual({ stop: false, reason: null });
    expect(shouldStop({ decisions: { idleStop: false } }, { tick: 3, maxTicks: 10 })).toEqual({ stop: false, reason: null });
  });
});

describe('tickSurface — a faithful projection of the core decisions (drops nothing, invents nothing)', () => {
  it('projects status, notes, every dispatch kind, and watchers', () => {
    const out = { decisions: {
      statusLine: 'conveyor · 2 building',
      counts: { building: 2, preparing: 1, fixing: 1, healing: 1, queued: 3, parked: 0, verdict: 'ok' },
      notes: [{ kind: 'build-ttl', text: '⚠ re-dispatching' }],
      spawnBuilds: [{ num: 1, lane: 1 }], spawnPrepareScope: [{ num: 2, lane: 2 }],
      spawnPrepareDecision: [{ num: 3, lane: 3 }], spawnFixes: [{ pr: 9 }], spawnCiHeals: [{ pr: 10 }],
      armWatchers: [{ pr: 9, releaseSession: 'conveyor-1' }],
    } };
    const s = tickSurface(out);
    expect(s.statusLine).toBe('conveyor · 2 building');
    // #3398 — the structured tallies pass through verbatim, for the supervisor's alerting to read.
    expect(s.counts).toEqual({ building: 2, preparing: 1, fixing: 1, healing: 1, queued: 3, parked: 0, verdict: 'ok' });
    expect(s.notes).toHaveLength(1);
    expect(s.dispatch).toEqual({
      builds: [{ num: 1, lane: 1 }], prepareScope: [{ num: 2, lane: 2 }],
      prepareDecision: [{ num: 3, lane: 3 }], fixes: [{ pr: 9 }], ciHeals: [{ pr: 10 }],
    });
    expect(s.armWatchers).toEqual([{ pr: 9, releaseSession: 'conveyor-1' }]);
  });
  it('is total on a bare tick output (all empties, never throws)', () => {
    const s = tickSurface({});
    expect(s).toEqual({ statusLine: '', counts: null, notes: [], dispatch: { builds: [], prepareScope: [], prepareDecision: [], fixes: [], ciHeals: [] }, armWatchers: [] });
  });
});

describe('runLoop — the runner control flow over injected effects', () => {
  it('defaults the tick interval to the SKILL heartbeat', () => {
    expect(DEFAULT_TICK_INTERVAL_MS).toBe(120_000);
  });

  it('steps the core, carries nextState forward UNCHANGED, and stops on idle-stop', async () => {
    // Tick 0 returns a live plan + nextState; tick 1 the core reports idle-stop → the loop stops after it.
    const outs = [
      { decisions: { idleStop: false, statusLine: 't0', spawnBuilds: [{ num: 5, lane: 1 }] }, nextState: { tick: 1, buildGuards: [{ num: 5, lane: 1, spawnedTick: 0 }] } },
      { decisions: { idleStop: true, statusLine: 't1' }, nextState: { tick: 2, buildGuards: [] } },
    ];
    const seenPayloads = [];
    const emitted = [];
    let heartbeats = 0;
    const res = await runLoop({
      tickOnce: (payload) => { seenPayloads.push(payload); return outs[Math.min(seenPayloads.length - 1, outs.length - 1)]; },
      emit: (s) => emitted.push(s),
      heartbeat: () => { heartbeats++; return true; },
      sleep: () => {},
      maxTicks: Infinity,
      initial: { bootstrap: true },
    });
    expect(res.stoppedReason).toBe('idle-stop');
    expect(res.ticks).toBe(2);
    // Tick 0 saw the bootstrap payload; tick 1 saw EXACTLY the core's tick-0 nextState (threaded unchanged).
    expect(seenPayloads[0]).toEqual({ bootstrap: true });
    expect(seenPayloads[1].bookkeeping).toEqual({ tick: 1, buildGuards: [{ num: 5, lane: 1, spawnedTick: 0 }] });
    // Every tick surfaced; a heartbeat only between ticks (once), not after the terminal idle tick.
    expect(emitted.map((e) => e.statusLine)).toEqual(['t0', 't1']);
    expect(heartbeats).toBe(1);
  });

  it('respects the --once / max-ticks budget', async () => {
    let calls = 0;
    const res = await runLoop({
      tickOnce: () => { calls++; return { decisions: { idleStop: false }, nextState: { tick: calls } }; },
      sleep: () => {},
      maxTicks: 1,
    });
    expect(res.stoppedReason).toBe('max-ticks');
    expect(calls).toBe(1);
  });

  it('STOPS when the singleton lease is lost (reclaimed away mid-run)', async () => {
    // The heartbeat returns false on the 2nd tick — the runner went stale and another process took the lease.
    let n = 0;
    const res = await runLoop({
      tickOnce: () => ({ decisions: { idleStop: false }, nextState: { tick: ++n } }),
      heartbeat: () => n < 2,   // tick 0 heartbeat ok, tick 1 heartbeat lost
      sleep: () => {},
      maxTicks: Infinity,
    });
    expect(res.stoppedReason).toBe('lease-lost');
    expect(res.ticks).toBe(2);
  });

  it('a throwing mechanical pass never wedges the loop (best-effort §4b/§4c)', async () => {
    const res = await runLoop({
      tickOnce: () => ({ decisions: { idleStop: true }, nextState: {} }),
      mechanicalPasses: () => { throw new Error('reaper blew up'); },
      sleep: () => {},
    });
    expect(res.stoppedReason).toBe('idle-stop');  // the throw was swallowed; the tick still completed
  });

  it('#3404 — threads its OWN heartbeat effect into mechanicalPasses, so a pass that outlasts the lease TTL can extend it mid-pass', async () => {
    // Fails today (before #3404): `mechanicalPasses` was called with no `heartbeat` in its ctx at all, so a
    // real long-running pass (the #3105 verify-dispatch pass) had no way to heartbeat until AFTER it returned
    // — exactly the stale-lease-mid-run window #2453 already fixed for the plateau-app drain daemon.
    let calls = 0;
    const res = await runLoop({
      tickOnce: () => ({ decisions: { idleStop: true }, nextState: {} }),
      // Simulate a slow pass (like `runQuietHeartbeating`'s real interval) calling the heartbeat it was HANDED
      // several times while it "runs", not merely receiving one bracketing call from the loop itself.
      mechanicalPasses: async ({ heartbeat }) => {
        expect(typeof heartbeat).toBe('function');
        heartbeat(); heartbeat(); heartbeat(); // 3 mid-pass heartbeats simulating 3 elapsed intervals
      },
      heartbeat: () => { calls++; return true; },
      sleep: () => {},
    });
    // The mechanicalPasses fake called the SAME heartbeat effect the loop itself uses after the tick — so all
    // calls land on the one counter; asserting 3+ (not exactly 1) is what pins "mid-pass", not just "bracketed".
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(res.stoppedReason).toBe('idle-stop');
  });

  it('requires a tickOnce effect', async () => {
    await expect(runLoop({})).rejects.toThrow(/tickOnce/);
  });
});

// ── (2b) dispatchPass (#3383) — the runner carries the DISPATCH PASS's nextState forward, not the raw tick's ─

describe('runLoop — dispatchPass (#3383): carries the dispatch pass\'s nextState forward, fails soft', () => {
  it('the NEXT tick sees the dispatch pass\'s nextState, not the raw tick\'s own', async () => {
    // Tick 0's own raw nextState says `{ tick: 1, from: 'raw' }`; a fake dispatchPass (standing in for
    // `dispatch-lane`'s nested tick-core read actually recording the new guard) returns a DIFFERENT one. The
    // second `tickOnce` call must receive the dispatch pass's copy, per the file header's #3383 rationale.
    const seenPayloads = [];
    const res = await runLoop({
      tickOnce: (payload) => {
        seenPayloads.push(payload);
        return seenPayloads.length === 1
          ? { decisions: { idleStop: false }, nextState: { tick: 1, from: 'raw' } }
          : { decisions: { idleStop: true }, nextState: { tick: 2, from: 'raw' } };
      },
      dispatchPass: async () => ({ nextState: { tick: 1, from: 'dispatch-pass' } }),
      sleep: () => {},
      maxTicks: 2,
    });
    expect(res.ticks).toBe(2);
    expect(seenPayloads[1].bookkeeping).toEqual({ tick: 1, from: 'dispatch-pass' });
  });

  it('the DEFAULT dispatchPass (omitted) is an identity pass-through — legacy behaviour is preserved', async () => {
    // No override supplied: the next tick's payload must carry the SAME nextState the tick itself produced.
    const seenPayloads = [];
    const res = await runLoop({
      tickOnce: (payload) => {
        seenPayloads.push(payload);
        return seenPayloads.length === 1
          ? { decisions: { idleStop: false }, nextState: { tick: 1, from: 'raw' } }
          : { decisions: { idleStop: true }, nextState: { tick: 2, from: 'raw' } };
      },
      sleep: () => {},
      maxTicks: 2,
    });
    expect(res.ticks).toBe(2);
    expect(seenPayloads[1].bookkeeping).toEqual({ tick: 1, from: 'raw' });
  });

  it('a THROWING dispatchPass fails soft — the loop keeps going and falls back to the raw tick nextState', async () => {
    const seenPayloads = [];
    const res = await runLoop({
      tickOnce: (payload) => {
        seenPayloads.push(payload);
        return seenPayloads.length === 1
          ? { decisions: { idleStop: false }, nextState: { tick: 1, from: 'raw' } }
          : { decisions: { idleStop: true }, nextState: { tick: 2, from: 'raw' } };
      },
      dispatchPass: async () => { throw new Error('dispatch-lane exploded'); },
      sleep: () => {},
      maxTicks: 2,
    });
    // The loop never crashed and completed both ticks; the second tick's payload falls back to tick 0's own
    // raw nextState (the pre-throw default set before `dispatchPass` is awaited).
    expect(res.ticks).toBe(2);
    expect(seenPayloads[1].bookkeeping).toEqual({ tick: 1, from: 'raw' });
  });

  it('xpshzms (#3571) — calls mechanicalPasses BEFORE dispatchPass every tick, so a long dispatch backlog can never starve the monitoring sweeps of a turn', async () => {
    const calls = [];
    const res = await runLoop({
      tickOnce: () => ({ decisions: { idleStop: true }, nextState: {} }),
      mechanicalPasses: async () => { calls.push('mechanicalPasses'); },
      dispatchPass: async () => { calls.push('dispatchPass'); return { nextState: {} }; },
      sleep: () => {},
    });
    expect(calls).toEqual(['mechanicalPasses', 'dispatchPass']);
    expect(res.stoppedReason).toBe('idle-stop');
  });
});

// ── (3) driveConveyor — the lease lifecycle: ALWAYS released, never behind process.exit ─────────────────────

describe('driveConveyor — acquire → drive → ALWAYS release (no leaked singleton lease)', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'runner-drive-')); });
  afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

  const boundedEffects = () => ({
    tickOnce: () => ({ decisions: { idleStop: false }, nextState: {} }),
    sleep: () => {},
    maxTicks: 1,
  });

  it('RELEASES the lease on a clean bounded exit (the leak the finally-after-exit bug caused)', async () => {
    const res = await driveConveyor({ lockRoot: root, owner: 'A', buildEffects: boundedEffects });
    expect(res).toMatchObject({ started: true, ticks: 1, stoppedReason: 'max-ticks' });
    // The lease MUST be gone — a next launch inside the TTL would otherwise falsely stand down.
    expect(runnerLeaseStatus(root, { nowMs: Date.now() }).held).toBe(false);
    expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull();
  });

  it('STANDS DOWN on a held lease without touching the incumbent (started:false, no build, no release)', async () => {
    acquireRunnerLease(root, 'INCUMBENT', { leaseMinutes: 15 });
    let built = false;
    const res = await driveConveyor({ lockRoot: root, owner: 'B', buildEffects: () => { built = true; return boundedEffects(); } });
    expect(res).toMatchObject({ started: false, heldBy: 'INCUMBENT' });
    expect(built).toBe(false);                                            // never drove
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('INCUMBENT'); // incumbent's lease untouched
  });

  it('RELEASES the lease even when the loop throws (finally, not behind an exit)', async () => {
    const throwing = () => ({ tickOnce: () => { throw new Error('tick-core exploded'); }, sleep: () => {}, maxTicks: 1 });
    await expect(driveConveyor({ lockRoot: root, owner: 'A', buildEffects: throwing })).rejects.toThrow(/exploded/);
    expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull(); // released despite the throw
  });

  it('requires a buildEffects factory', async () => {
    await expect(driveConveyor({ lockRoot: root, owner: 'A' })).rejects.toThrow(/buildEffects/);
  });
});

// ── (3b) installShutdownHandlers / finalEventLine — the SHUTDOWN CONTRACT, unit half ───────────────────────
//
//  The LIVE half (a real child, a real SIGTERM, the real supervisor stdout parser) is
//  `./runner-shutdown-live.test.mjs`; this half pins the DECISIONS that file cannot see from outside a
//  process — which signals are hooked, that the handler is re-entrant-safe, that a throwing release still
//  lets the process die, and the exact bytes of the final event line.

describe('installShutdownHandlers — release the singleton lease on SIGTERM/SIGINT, then die by that signal', () => {
  /** A fake signal table, so no test ever registers a real handler on the vitest worker itself. */
  const fakeSignals = () => {
    const reg = new Map();
    return {
      reg,
      on: (sig, fn) => { reg.set(sig, [...(reg.get(sig) || []), fn]); },
      off: (sig, fn) => { reg.set(sig, (reg.get(sig) || []).filter((f) => f !== fn)); },
      fire: (sig) => { for (const fn of [...(reg.get(sig) || [])]) fn(); },
    };
  };

  it('hooks BOTH SIGTERM and SIGINT (the supervisor sends the first; Ctrl-C sends the second)', () => {
    const s = fakeSignals();
    installShutdownHandlers({ lockRoot: '/lock', owner: 'A', release: () => true, on: s.on, off: s.off, raise: () => {}, log: () => {} });
    expect([...s.reg.keys()].sort()).toEqual(['SIGINT', 'SIGTERM']);
    expect(SHUTDOWN_SIGNALS).toEqual(['SIGTERM', 'SIGINT']);
  });

  it('releases the lease for the EXACT (lockRoot, owner) it was installed with, then re-raises the SAME signal', () => {
    const s = fakeSignals();
    const released = [];
    const raised = [];
    installShutdownHandlers({
      lockRoot: '/lock', owner: 'OWNER-X', release: (r, o) => { released.push([r, o]); return true; },
      on: s.on, off: s.off, raise: (sig) => raised.push(sig), log: () => {},
    });
    s.fire('SIGTERM');
    expect(released).toEqual([['/lock', 'OWNER-X']]);
    // Re-raise, NOT process.exit(0): `classifyExit` short-circuits on `signal` before it reads the code, so an
    // exit-0 here would silently reclassify every killed runner as a CLEAN exit.
    expect(raised).toEqual(['SIGTERM']);
  });

  it('REMOVES its handler BEFORE re-raising, so the re-raise hits Node\'s default disposition (no signal loop)', () => {
    const s = fakeSignals();
    let stillRegisteredAtRaise = null;
    installShutdownHandlers({
      lockRoot: '/lock', owner: 'A', release: () => true, on: s.on, off: s.off, log: () => {},
      raise: () => { stillRegisteredAtRaise = (s.reg.get('SIGTERM') || []).length; },
    });
    s.fire('SIGTERM');
    expect(stillRegisteredAtRaise).toBe(0);              // deregistered BEFORE the raise, not after
    expect((s.reg.get('SIGINT') || []).length).toBe(0);  // the sibling signal is unhooked too
  });

  it('is re-entrant-safe — a second signal mid-shutdown never double-releases or re-raises', () => {
    const s = fakeSignals();
    let releases = 0; const raised = [];
    installShutdownHandlers({
      lockRoot: '/lock', owner: 'A', release: () => { releases += 1; return true; },
      on: s.on, off: s.off, raise: (sig) => raised.push(sig), log: () => {},
    });
    const fn = s.reg.get('SIGTERM')[0];
    fn(); fn();                        // the second arrives while the first is still unwinding
    expect(releases).toBe(1);
    expect(raised).toEqual(['SIGTERM']);
  });

  it('STILL DIES when the release throws — a broken lock file must never wedge a shutdown', () => {
    const s = fakeSignals();
    const raised = [];
    installShutdownHandlers({
      lockRoot: '/lock', owner: 'A', release: () => { throw new Error('EACCES'); },
      on: s.on, off: s.off, raise: (sig) => raised.push(sig), log: () => {},
    });
    expect(() => s.fire('SIGTERM')).not.toThrow();
    expect(raised).toEqual(['SIGTERM']);  // the TTL backstops the lease; the exit is not negotiable
  });

  it('says which happened — "released" vs "not held" (a signal arriving before the lease was acquired)', () => {
    const s = fakeSignals();
    const lines = [];
    installShutdownHandlers({ lockRoot: '/l', owner: 'A', release: () => false, on: s.on, off: s.off, raise: () => {}, log: (x) => lines.push(x) });
    s.fire('SIGINT');
    expect(lines.join('')).toMatch(/SIGINT — singleton lease not held/);
  });

  it('releases a REAL lease in a REAL temp lock root through the DEFAULT release (not just an injected stub)', () => {
    const root = mkdtempSync(join(tmpdir(), 'runner-sig-'));
    try {
      acquireRunnerLease(root, 'HOLDER', { leaseMinutes: 15 });
      expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('HOLDER');
      const s = fakeSignals();
      installShutdownHandlers({ lockRoot: root, owner: 'HOLDER', on: s.on, off: s.off, raise: () => {}, log: () => {} });
      s.fire('SIGTERM');                                          // production `releaseRunnerLeaseIfOwned`
      expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull();
    } finally { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } }
  });

  it('NEVER stomps a lease another owner reclaimed after a stale window (the fencing invariant)', () => {
    const root = mkdtempSync(join(tmpdir(), 'runner-sig-fence-'));
    try {
      acquireRunnerLease(root, 'RECLAIMER', { leaseMinutes: 15 });
      const s = fakeSignals();
      installShutdownHandlers({ lockRoot: root, owner: 'STALE-ME', on: s.on, off: s.off, raise: () => {}, log: () => {} });
      s.fire('SIGTERM');
      expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('RECLAIMER'); // untouched
    } finally { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } }
  });

  it('dispose() unhooks everything — no handler survives to fire after a caller tears it down', () => {
    const s = fakeSignals();
    let releases = 0;
    const { dispose } = installShutdownHandlers({
      lockRoot: '/l', owner: 'A', release: () => { releases += 1; return true; },
      on: s.on, off: s.off, raise: () => {}, log: () => {},
    });
    dispose();
    s.fire('SIGTERM'); s.fire('SIGINT');
    expect(releases).toBe(0);
  });
});

describe('finalEventLine — the exact bytes supervisor.mjs parses (the field is stoppedReason, NOT reason)', () => {
  it('a started run emits {event:"stopped", stoppedReason, ticks}', () => {
    expect(JSON.parse(finalEventLine({ started: true, stoppedReason: 'idle-stop', ticks: 7 })))
      .toEqual({ event: 'stopped', stoppedReason: 'idle-stop', ticks: 7 });
  });

  it('a stand-down emits {event:"stood-down", heldBy} — the supervisor maps THAT to "stand-down" itself', () => {
    expect(JSON.parse(finalEventLine({ started: false, heldBy: 'Mac:9:conveyor-runner' })))
      .toEqual({ event: 'stood-down', heldBy: 'Mac:9:conveyor-runner' });
  });

  it('is ONE line of parseable JSON with no embedded newline (the supervisor reads it line-by-line)', () => {
    const line = finalEventLine({ started: true, stoppedReason: 'max-ticks', ticks: 1 });
    expect(line).not.toContain('\n');
    expect(() => JSON.parse(line)).not.toThrow();
  });

  it('degrades rather than throws on a missing outcome (it runs on the way out; it must not crash there)', () => {
    expect(JSON.parse(finalEventLine(undefined))).toEqual({ event: 'stood-down', heldBy: null });
  });
});

// ── (4) summarizeMechanicalPassError — WE #3479, found live 2026-09-04 investigating a silent-looking
//        session-reaper.mjs tick failure ────────────────────────────────────────────────────────────────────

describe('summarizeMechanicalPassError — the real error, not just execFileSync\'s first "Command failed" line', () => {
  it('keeps the child stderr Node appends to `.message`, not just the leading "Command failed: <cmd>" line', () => {
    // Reproduces exactly what a real `execFileSync` throw looks like: Node appends the captured stderr to
    // `.message` after the "Command failed: ..." line — this is the shape the OLD `.split(\'\\n\')[0]` threw
    // away, live, for the one session-reaper.mjs failure this file's own commit is fixing.
    const e = new Error(
      'Command failed: node /Users/x/scripts/conveyor/session-reaper.mjs\n' +
        '  ⚠ abcd1234: stop failed after 3 attempts (dispatch-abort: `claude stop abcd1234` failed: some transient CLI lock) — left for the next tick\n' +
        'session-reaper: 40 session(s) listed · 12 stopped, 1 failed · 27 kept',
    );
    const summary = summarizeMechanicalPassError(e);
    expect(summary).toContain('stop failed after 3 attempts');
    expect(summary).toContain('transient CLI lock');
    expect(summary).toContain('session-reaper: 40 session(s) listed');
  });

  it('collapses newlines so a multi-line error still logs as ONE line', () => {
    const summary = summarizeMechanicalPassError(new Error('line one\nline two\nline three'));
    expect(summary).not.toContain('\n');
    expect(summary).toBe('line one line two line three');
  });

  it('is bounded — a runaway message never floods the log unbounded', () => {
    const huge = new Error('x'.repeat(5000));
    const summary = summarizeMechanicalPassError(huge);
    expect(summary.length).toBeLessThanOrEqual(MECHANICAL_PASS_ERROR_LOG_CHARS);
  });

  it('falls back to String(e) for a non-Error thrown value', () => {
    expect(summarizeMechanicalPassError('a plain string failure')).toBe('a plain string failure');
  });
});

// ── (5) makeCliMechanicalPasses' review-reconcile block — x5v8yy9 review finding, 2026-09-05: before this
//        fix, `review-round-tag.mjs` ran unconditionally after `review-dispatch.mjs`, even when the dispatch
//        attempt itself threw and no session was ever spawned — so a PR's `review-round:<N>` label kept
//        advancing every tick regardless of whether a review actually happened ─────────────────────────────

describe('makeCliMechanicalPasses — the review-reconcile dispatch block never advances review-round on a failed dispatch', () => {
  /** Route each mocked `execFileSync` call by which script it invokes, recording every call along the way. */
  function makeExecFileSyncRouter({ plan, dispatchThrows = false }) {
    const calls = [];
    return {
      calls,
      execFileSync: vi.fn((cmd, args) => {
        calls.push([cmd, ...args]);
        const joined = args.join(' ');
        if (joined.includes('reconcile-pass.mjs')) return JSON.stringify(plan);
        if (cmd === 'gh' && args.includes('repo') && args.includes('view')) return 'owner/repo';
        return ''; // every other best-effort pass (infra-blocked, lease-reaper, review-round-tag, review-status-tag, ...)
      }),
      // #xu2pp2m — the dispatch is a SPAWN now, and its EXIT CODE is the signal: a non-zero exit means
      // `blocked-on-infra` (the review loop could not run), which is exactly what must not advance the round
      // label. `dispatchThrows` keeps its original meaning — "this dispatch produced no review".
      spawn: vi.fn(makeSpawnRouter(calls, (joined) => (
        dispatchThrows && joined.includes('review-dispatch.mjs') ? 1 : 0
      ))),
    };
  }

  it('SKIPS review-round-tag.mjs for a PR whose review-dispatch.mjs call threw', async () => {
    const { execFileSync, spawn, calls } = makeExecFileSyncRouter({
      dispatchThrows: true,
      plan: { dispatch: [{ kind: 'review', prNumber: 99, attempts: 0 }], refusals: [] },
    });
    const cp = await import('node:child_process');
    cp.execFileSync.mockImplementation(execFileSync);
    if (typeof spawn === 'function') cp.spawn.mockImplementation(spawn);

    const mechanicalPasses = makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'owner/repo' });
    await mechanicalPasses({ out: {} });

    const dispatchCalls = calls.filter((c) => c.join(' ').includes('review-dispatch.mjs'));
    const roundTagCalls = calls.filter((c) => c.join(' ').includes('review-round-tag.mjs'));
    expect(dispatchCalls).toHaveLength(1); // the dispatch WAS attempted
    expect(roundTagCalls).toHaveLength(0); // but the round label must NOT advance — nothing was spawned
  });

  it('DOES run review-round-tag.mjs when the dispatch actually succeeds', async () => {
    const { execFileSync, spawn, calls } = makeExecFileSyncRouter({
      dispatchThrows: false,
      plan: { dispatch: [{ kind: 'review', prNumber: 99, attempts: 2 }], refusals: [] },
    });
    const cp = await import('node:child_process');
    cp.execFileSync.mockImplementation(execFileSync);
    if (typeof spawn === 'function') cp.spawn.mockImplementation(spawn);

    const mechanicalPasses = makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'owner/repo' });
    await mechanicalPasses({ out: {} });

    const roundTagCalls = calls.filter((c) => c.join(' ').includes('review-round-tag.mjs'));
    expect(roundTagCalls).toHaveLength(1);
    expect(roundTagCalls[0]).toEqual(expect.arrayContaining(['99', '--repo=owner/repo', '--round=3']));
  });

  it('still runs the informative review-status-tag.mjs sweep even when the dispatch above it failed', async () => {
    const { execFileSync, spawn, calls } = makeExecFileSyncRouter({
      dispatchThrows: true,
      plan: { dispatch: [{ kind: 'review', prNumber: 99, attempts: 0 }], refusals: [] },
    });
    const cp = await import('node:child_process');
    cp.execFileSync.mockImplementation(execFileSync);
    if (typeof spawn === 'function') cp.spawn.mockImplementation(spawn);

    const mechanicalPasses = makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'owner/repo' });
    await mechanicalPasses({ out: {} });

    const statusTagCalls = calls.filter((c) => c.join(' ').includes('review-status-tag.mjs'));
    expect(statusTagCalls).toHaveLength(1); // reviewsOwed still feeds selectStatusCandidates regardless
  });

  // #xu2pp2m — THE BLOCK NO LONGER REPORTS ITSELF FAILED WHEN IT SUCCEEDED.
  //
  // A duplicated copy of the two loops above (merge artifact `c014ef4`) sat outside
  // `for (const d of reviewsOwed)` and still referenced `d`, whose scope ends with that loop — so reaching it
  // ALWAYS threw `ReferenceError: d is not defined`. The work itself had already been done by then, so
  // nothing went unlabelled; what broke was the LOG. Every tick with reviews owed ended in
  // `⚠ mechanical pass review-reconcile dispatch failed (non-fatal): d is not defined`, a permanent false
  // positive sitting exactly where an operator looks for a real dispatch failure.
  it('does NOT log a review-reconcile failure on a tick where the dispatch actually SUCCEEDED', async () => {
    const { execFileSync, spawn, calls } = makeExecFileSyncRouter({
      dispatchThrows: false,
      plan: { dispatch: [{ kind: 'review', prNumber: 99, attempts: 0 }], refusals: [] },
    });
    const cp = await import('node:child_process');
    cp.execFileSync.mockImplementation(execFileSync);
    if (typeof spawn === 'function') cp.spawn.mockImplementation(spawn);

    const stderr = [];
    const write = process.stderr.write;
    process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true; };
    try {
      await makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'owner/repo' })({ out: {} });
    } finally {
      process.stderr.write = write;
    }

    // The work DID happen (so this is not vacuously green on a block that never ran)…
    expect(calls.filter((c) => c.join(' ').includes('review-round-tag.mjs'))).toHaveLength(1);
    // …and it did not announce a failure while doing it.
    expect(stderr.join('')).not.toMatch(/review-reconcile dispatch failed/);
    expect(stderr.join('')).not.toMatch(/is not defined/);
  });
});

// ── (6) makeCliMechanicalPasses' OWN "does it still invoke every mechanical pass" proof — xb4fjir, filed as
//        the OWED prevention on the #1949 review finding (2026-09-05): before this test, deleting any single
//        `runQuiet('conveyor/<pass>.mjs', …)` line reddened nothing here — this file only ever mocked
//        `execFileSync` generically and asserted individual passes' own behavior, never the SET the function
//        invokes each tick. A future refactor/reorder/accidental deletion could silently drop a mechanical
//        pass (e.g. `duplicate-pr-watch.mjs`, `parked-pr-conflict-watch.mjs`) with nothing here noticing —
//        exactly the failure class #xs19sz9's own duplicate-PR watch exists to catch, made invisible again by
//        its own wiring silently regressing. ─────────────────────────────────────────────────────────────

describe('makeCliMechanicalPasses — invokes the exact set of mechanical passes, in order, every tick', () => {
  it('a plain tick (no reconcile findings) runs exactly this ordered script list, with --repo threaded through', async () => {
    const calls = [];
    const execFileSync = vi.fn((cmd, args) => {
      calls.push([cmd, ...args]);
      const joined = args.join(' ');
      if (joined.includes('reconcile-pass.mjs')) return JSON.stringify({ dispatch: [], refusals: [] });
      return ''; // every other best-effort pass — this test only cares WHICH scripts run, not their own output
    });
    const cp = await import('node:child_process');
    cp.execFileSync.mockImplementation(execFileSync);
    if (typeof spawn === 'function') cp.spawn.mockImplementation(spawn);

    const mechanicalPasses = makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'owner/repo' });
    await mechanicalPasses({ out: {} });

    // The exact relative script path (or literal flag) each call carries, in the order `execFileSync` saw them
    // — mutating this list is the mechanical check: delete/reorder/rename a `runQuiet(...)` line above and this
    // assertion goes red, which is the whole point (a `grep` for the added line, this PR's own backlog card
    // cited as its only prior check, catches none of that).
    expect(calls.map((c) => c.join(' '))).toEqual([
      'node /scripts/conveyor/infra-blocked.mjs retry --repo=owner/repo',
      'node /scripts/conveyor/lease-reaper.mjs --repo=owner/repo',
      'node /scripts/conveyor/session-reaper.mjs --repo=owner/repo',
      'node /scripts/conveyor/reconcile-fix-dispatch.mjs --repo=owner/repo',
      'node /scripts/conveyor/branch-drift.mjs sweep --repo=owner/repo',
      'node /scripts/conveyor/ci-queue-watch.mjs sweep --repo=owner/repo',
      'node /scripts/conveyor/parked-pr-conflict-watch.mjs sweep --repo=owner/repo',
      'node /scripts/conveyor/lane-pool-health-watch.mjs --repo=owner/repo',
      'node /scripts/conveyor/reconcile-pass.mjs --json --repo=owner/repo',
      'node /scripts/conveyor/duplicate-pr-watch.mjs sweep --repo=owner/repo',
      'node /scripts/conveyor/parked-pr-progress-watch.mjs sweep --repo=owner/repo',
    ]);
  });
});
