/**
 * @file skills-src/conveyor/__tests__/pass-daemon.test.mjs
 * @description Unit proof of #3871's generic single-pass daemon — the pure loop only (no real child process,
 *   no real timer, no real lease): injected effects, mirroring #3870's own `runDaemonLoop` tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { runPassDaemonLoop, passDaemonLeaseKey, realSleep, DEFAULT_HEARTBEAT_INTERVAL_MS } from '../pass-daemon.mjs';

describe('runPassDaemonLoop — the pure run/sleep control flow', () => {
  it('requires a runPass effect and a positive intervalMs', async () => {
    await expect(runPassDaemonLoop({ intervalMs: 1000 })).rejects.toThrow(/requires a runPass effect/);
    await expect(runPassDaemonLoop({ runPass: async () => ({}), intervalMs: 0 })).rejects.toThrow(/requires a positive intervalMs/);
    await expect(runPassDaemonLoop({ runPass: async () => ({}), intervalMs: -1 })).rejects.toThrow(/requires a positive intervalMs/);
  });

  it('runs, sleeps between runs, and stops at maxRuns', async () => {
    const sleep = vi.fn(async () => {});
    const runPass = vi.fn(async () => ({ code: 0 }));
    const out = await runPassDaemonLoop({ runPass, sleep, intervalMs: 5000, maxRuns: 3 });
    expect(runPass).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(out).toEqual({ runs: 3, stoppedReason: 'max-runs' });
  });

  it('a failing/throwing run is isolated — onRunError fires, the loop continues', async () => {
    const onRunError = vi.fn();
    let n = 0;
    const runPass = vi.fn(async () => { n += 1; if (n === 1) throw new Error('spawn failed'); return { code: 0 }; });
    const out = await runPassDaemonLoop({ runPass, sleep: async () => {}, onRunError, maxRuns: 2, intervalMs: 1000 });
    expect(runPass).toHaveBeenCalledTimes(2);
    expect(onRunError).toHaveBeenCalledTimes(1);
    expect(onRunError.mock.calls[0][0].message).toBe('spawn failed');
    expect(out).toEqual({ runs: 2, stoppedReason: 'max-runs' });
  });

  it('checks isAlive AFTER each run, before sleeping — a lost lease stops immediately, no extra sleep or run', async () => {
    let calls = 0;
    const isAlive = vi.fn(() => { calls += 1; return calls < 2; }); // alive after run 1, lost after run 2
    const sleep = vi.fn(async () => {});
    const runPass = vi.fn(async () => ({ code: 0 }));
    const out = await runPassDaemonLoop({ runPass, sleep, isAlive, intervalMs: 1000, maxRuns: Infinity });
    expect(runPass).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1); // slept after run 1 only
    expect(out).toEqual({ runs: 2, stoppedReason: 'lease-lost' });
  });

  it('onRun observes every successful result, in order, with the right run index', async () => {
    const seen = [];
    const results = [{ code: 0 }, { code: 1 }];
    let i = 0;
    const runPass = async () => results[i++];
    await runPassDaemonLoop({ runPass, sleep: async () => {}, onRun: (r, run) => seen.push([run, r]), maxRuns: 2, intervalMs: 1000 });
    expect(seen).toEqual([[0, results[0]], [1, results[1]]]);
  });
});

describe('passDaemonLeaseKey — one distinct key per pass name', () => {
  it('two different pass names never collide', () => {
    expect(passDaemonLeaseKey('branch-drift')).not.toBe(passDaemonLeaseKey('ci-queue-watch'));
  });
  it('the same pass name is always the same key (idempotent)', () => {
    expect(passDaemonLeaseKey('branch-drift')).toBe(passDaemonLeaseKey('branch-drift'));
  });
  it('never equals the Dispatcher default sentinel or #3870\'s own Fix-dispatch key', () => {
    expect(passDaemonLeaseKey('branch-drift')).not.toBe('<conveyor:runner-singleton-lease>');
    expect(passDaemonLeaseKey('branch-drift')).not.toBe('<conveyor:reconcile-fix-dispatch-daemon-lease>');
  });
});

describe('DEFAULT_HEARTBEAT_INTERVAL_MS — the independent-timer property this item exists for', () => {
  it('is meaningfully shorter than a realistic pass interval, so it can beat DURING a long single run', () => {
    expect(DEFAULT_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(DEFAULT_HEARTBEAT_INTERVAL_MS).toBeLessThan(120_000); // the runner's own tick cadence, for scale
  });
});

describe('realSleep — regression, live-caught on the sibling #3870/#3876 daemons', () => {
  // Both sibling daemons built on this exact `realSleep` pattern died right after their first run/tick
  // instead of looping: `.unref()`-ing the timer told Node it was fine to exit before it fired, and nothing
  // else kept the event loop alive between runs. This file shipped the same bug (confirmed by direct read)
  // — never caught live only because DAEMON_MANIFEST is still empty, so nothing has run through it yet.
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
});
