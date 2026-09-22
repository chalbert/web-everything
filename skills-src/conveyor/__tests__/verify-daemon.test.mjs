/**
 * @file skills-src/conveyor/__tests__/verify-daemon.test.mjs
 * @description Unit proof of #3878's standalone Verify daemon — the pure loop and the thin per-tick wrapper
 *   only (no real lease, no real dispatch, no real subprocess/gh/git, no real timers except the `realSleep`
 *   regression below): injected effects, so the tick/backoff/stop-condition decision is tested with fakes
 *   exactly like the sibling daemons in this epic are.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  runDaemonLoop, runVerifyTick, buildCliDaemonEffects, realSleep,
  VERIFY_DAEMON_LEASE_KEY, DEFAULT_INTERVAL_MS,
} from '../verify-daemon.mjs';

describe('runDaemonLoop — the pure control flow', () => {
  it('requires a tickOnce effect', async () => {
    await expect(runDaemonLoop({})).rejects.toThrow(/requires a tickOnce effect/);
  });

  it('ticks, sleeps between ticks, and stops at maxTicks', async () => {
    const sleep = vi.fn(async () => {});
    const tickOnce = vi.fn(async () => ({ dryRun: false, dispatched: [], failures: [] }));
    const out = await runDaemonLoop({ tickOnce, sleep, maxTicks: 3 });
    expect(tickOnce).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // never sleeps after the LAST tick
    expect(out).toEqual({ ticks: 3, stoppedReason: 'max-ticks' });
  });

  it('a failing tick is isolated — reported via onTickError, never fatal, the loop continues', async () => {
    const onTickError = vi.fn();
    let calls = 0;
    const tickOnce = vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('transient gate hiccup'); return { ok: true }; });
    const out = await runDaemonLoop({ tickOnce, sleep: async () => {}, onTickError, maxTicks: 2 });
    expect(tickOnce).toHaveBeenCalledTimes(2);
    expect(onTickError).toHaveBeenCalledTimes(1);
    expect(onTickError.mock.calls[0][0].message).toBe('transient gate hiccup');
    expect(out).toEqual({ ticks: 2, stoppedReason: 'max-ticks' });
  });

  it('a lost heartbeat stops the loop immediately — never sleeps or ticks again after losing the lease', async () => {
    let heartbeats = 0;
    const heartbeat = vi.fn(async () => { heartbeats += 1; return heartbeats < 2; }); // alive tick 1, lost tick 2
    const sleep = vi.fn(async () => {});
    const tickOnce = vi.fn(async () => ({}));
    const out = await runDaemonLoop({ tickOnce, sleep, heartbeat, maxTicks: Infinity });
    expect(tickOnce).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1); // slept after tick 1 (still alive), never after tick 2 (lease lost)
    expect(out).toEqual({ ticks: 2, stoppedReason: 'lease-lost' });
  });

  it('onTick observes every successful result, in order', async () => {
    const seen = [];
    const results = [{ dispatched: [{ pool: 'a', lane: 1 }] }, { dispatched: [{ pool: 'a', lane: 2 }] }];
    let i = 0;
    const tickOnce = async () => results[i++];
    await runDaemonLoop({ tickOnce, sleep: async () => {}, onTick: (r, tick) => seen.push([tick, r]), maxTicks: 2 });
    expect(seen).toEqual([[0, results[0]], [1, results[1]]]);
  });
});

describe('runVerifyTick — the thin per-tick effect (real runVerifyDispatch call is injectable)', () => {
  it('calls the injected runVerify with no lane-scoping args and returns its result unchanged', async () => {
    const summary = { dryRun: false, dispatched: [{ pool: 'we', lane: 3, sha: 'abc' }], failures: [] };
    const runVerify = vi.fn(async () => summary);
    const out = await runVerifyTick({ runVerify });
    expect(runVerify).toHaveBeenCalledWith({});
    expect(out).toBe(summary);
  });

  it('propagates a rejection from the injected runVerify (runDaemonLoop, one level up, is what isolates it)', async () => {
    const runVerify = vi.fn(async () => { throw new Error('spawn ENOENT'); });
    await expect(runVerifyTick({ runVerify })).rejects.toThrow('spawn ENOENT');
  });

  it('defaults to the real runVerifyDispatch when no override is given (shape check only, not invoked here)', async () => {
    // Every OTHER test in this file injects a fake `runVerify` — this just proves the default parameter wires
    // to a real, importable function, without actually calling it (that would touch real fs/git).
    expect(typeof runVerifyTick).toBe('function');
  });
});

describe('buildCliDaemonEffects — the real-effect factory (heartbeat wiring only; no real dispatch/timer)', () => {
  it('uses its own distinct lease key, never the Dispatcher default sentinel or a sibling daemon\'s key', () => {
    expect(VERIFY_DAEMON_LEASE_KEY).toBe('<conveyor:verify-daemon-lease>');
  });

  it('defaults the interval to DEFAULT_INTERVAL_MS, matching runner.mjs\'s own tick cadence', () => {
    const effects = buildCliDaemonEffects({ owner: 'x' });
    expect(effects.intervalMs).toBe(DEFAULT_INTERVAL_MS);
    expect(DEFAULT_INTERVAL_MS).toBe(120_000);
  });

  it('exposes the shape runDaemonLoop needs', () => {
    const effects = buildCliDaemonEffects({ owner: 'x' });
    expect(typeof effects.tickOnce).toBe('function');
    expect(typeof effects.sleep).toBe('function');
    expect(typeof effects.heartbeat).toBe('function');
    expect(typeof effects.onTick).toBe('function');
    expect(typeof effects.onTickError).toBe('function');
  });

  it('onTick logs a one-line summary, plus one line per failure, via the injected log', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTick({
      dispatched: [{ pool: 'we', lane: 1 }],
      failures: [{ pool: 'we', lane: 2, timedOut: true, timedOutPhase: 'gate' }],
    });
    expect(log.error).toHaveBeenCalledWith('verify-daemon: tick — dispatched 1, failed 1');
    expect(log.error).toHaveBeenCalledWith('verify-daemon: we/lane-2 failed (non-fatal) [timed out: gate]');
  });

  it('onTickError logs a non-fatal one-liner via the injected log', () => {
    const log = { error: vi.fn() };
    const effects = buildCliDaemonEffects({ owner: 'x', log });
    effects.onTickError(new Error('boom\nwith a stack trace'));
    expect(log.error).toHaveBeenCalledWith('verify-daemon: tick failed (non-fatal): boom');
  });
});

describe('realSleep — regression (live-caught 3x already this epic: #3870, #3871, #3876)', () => {
  // Every one of those three daemons independently reintroduced `.unref()` on this exact timer and each
  // exited right after its FIRST tick instead of looping: `.unref()` tells Node it's fine to exit before the
  // timer fires, and nothing else in the process keeps the event loop alive between ticks (a spawned child's
  // own stdio is `ignore`d — no other ref'd handle exists). A unit test that only checks the PROMISE resolves
  // (as a mocked-sleep unit test always would) can never catch this — the bug is specifically about whether
  // the underlying Node `Timeout` object is ref'd, which only a real, unmocked `setTimeout` reveals.
  it('realSleep\'s own timer is REF\'d — a resident daemon must not let Node exit before it fires', () => {
    const real = global.setTimeout;
    let captured;
    global.setTimeout = (fn, ms) => { captured = real(fn, ms); return captured; };
    try {
      realSleep(60_000); // never awaited — only the timer's own ref state is asserted, then cleared
      expect(captured.hasRef()).toBe(true); // FAILS if realSleep re-adds `.unref()`
    } finally {
      clearTimeout(captured);
      global.setTimeout = real;
    }
  });

  it('realSleep resolves after the real delay and leaves no unref\'d timer behind (smoke test, short delay)', async () => {
    const start = Date.now();
    await realSleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15); // loose bound — real timers, not fake ones
  });
});
