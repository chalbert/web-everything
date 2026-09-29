/**
 * @file daemon-boot-watchdog.test.mjs — #4468 part 2. Pure `decideCrashLoop` coverage, a real fs round-trip
 * for the history/bootConfirmed state file, and `runSupervisedStart` with every IO edge injected (spawn, git,
 * rollback) — no real process is ever spawned or reverted here. The live, real-process proof (a genuinely
 * crash-looping child, reverted for real on a scratch clone) lives in
 * `daemon-boot-watchdog-live.test.mjs`.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appendBootAttempt, clearBootAttempts, crashLoopCount, decideCrashLoop, DEFAULT_CRASH_LOOP_COUNT,
  DEFAULT_SURVIVAL_MS, readBootState, recordBootConfirmed, runSupervisedStart, survivalMs,
} from '../daemon-boot-watchdog.mjs';

describe('decideCrashLoop — pure', () => {
  const fast = (startedAt, head = 'sha-x') => ({ startedAt, exitedAt: startedAt + 100, head });
  const slow = (startedAt, head = 'sha-x') => ({ startedAt, exitedAt: startedAt + 60_000, head });

  it('is never a loop with fewer attempts than the count threshold', () => {
    expect(decideCrashLoop({ history: [fast(0), fast(1000)], thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
  });

  it('is a loop when the last countThreshold attempts are all fast exits on the SAME head', () => {
    expect(decideCrashLoop({ history: [fast(0), fast(1000), fast(2000)], thresholdMs: 15_000, countThreshold: 3 })).toBe(true);
  });

  it('only the CONSECUTIVE tail counts — an earlier slow (survived) attempt does not poison a later fast streak', () => {
    const history = [slow(0), fast(1000), fast(2000), fast(3000)];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(true);
  });

  it('a slow attempt inside the tail window clears the loop', () => {
    const history = [fast(0), slow(1000), fast(2000)];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
  });

  it('more attempts than the threshold still only judges the last countThreshold', () => {
    const history = [fast(0), fast(1000), slow(2000), fast(3000), fast(4000), fast(5000)];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(true);
  });

  it('survives a junk/empty history without throwing', () => {
    expect(decideCrashLoop({ history: null, thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
    expect(decideCrashLoop({ history: [], thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
    expect(decideCrashLoop({ history: [null, undefined, {}], thresholdMs: 15_000, countThreshold: 1 })).toBe(false);
  });

  // #4468 review — the live-caught gap: a streak must never be attributed to a candidate that did not
  // actually produce every failure in it.
  it('two fast exits on a broken head, then a NEW head that has only failed once, is NOT a 3-in-a-row loop', () => {
    const history = [fast(0, 'head-B'), fast(1000, 'head-B'), fast(2000, 'head-C')];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
  });

  it('three fast exits all on the new head DOES trip, even right after a different head\'s own failures', () => {
    const history = [fast(0, 'head-B'), fast(1000, 'head-C'), fast(2000, 'head-C'), fast(3000, 'head-C')];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(true);
  });

  it('refuses to judge (never trips) when the most recent attempt has no known head', () => {
    const history = [fast(0, 'head-B'), fast(1000, 'head-B'), fast(2000, null)];
    expect(decideCrashLoop({ history, thresholdMs: 15_000, countThreshold: 3 })).toBe(false);
  });
});

describe('survivalMs / crashLoopCount — env overrides', () => {
  it('falls back to the default on a missing/invalid override', () => {
    expect(survivalMs({})).toBe(DEFAULT_SURVIVAL_MS);
    expect(crashLoopCount({})).toBe(DEFAULT_CRASH_LOOP_COUNT);
    expect(survivalMs({ WE_DAEMON_BOOT_SURVIVAL_MS: 'nonsense' })).toBe(DEFAULT_SURVIVAL_MS);
  });

  it('honors a valid override', () => {
    expect(survivalMs({ WE_DAEMON_BOOT_SURVIVAL_MS: '5000' })).toBe(5000);
    expect(crashLoopCount({ WE_DAEMON_BOOT_CRASH_LOOP_COUNT: '5' })).toBe(5);
  });
});

describe('boot-history state file — real fs round-trip', () => {
  let stateDir; let root; let env;
  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'daemon-boot-state-'));
    root = join(tmpdir(), 'fake-clone-root-for-key-derivation');
    env = { WE_DAEMON_STATE_DIR: stateDir };
  });
  afterEach(() => { rmSync(stateDir, { recursive: true, force: true }); });

  it('starts empty when nothing is on disk yet', () => {
    expect(readBootState(root, env)).toEqual({ attempts: [], bootConfirmed: null });
  });

  it('appendBootAttempt round-trips and trims to maxHistory', () => {
    for (let i = 0; i < 5; i += 1) appendBootAttempt(root, { startedAt: i, exitedAt: i + 1 }, { env, maxHistory: 3 });
    const state = readBootState(root, env);
    expect(state.attempts).toHaveLength(3);
    expect(state.attempts.map((a) => a.startedAt)).toEqual([2, 3, 4]);
  });

  it('recordBootConfirmed stamps the head and clears prior attempt history', () => {
    appendBootAttempt(root, { startedAt: 0, exitedAt: 1 }, { env });
    recordBootConfirmed(root, { head: 'abc123' }, env);
    const state = readBootState(root, env);
    expect(state.bootConfirmed.head).toBe('abc123');
    expect(state.attempts).toEqual([]);
  });

  it('clearBootAttempts keeps bootConfirmed but empties attempts', () => {
    recordBootConfirmed(root, { head: 'abc123' }, env);
    appendBootAttempt(root, { startedAt: 0, exitedAt: 1 }, { env });
    clearBootAttempts(root, env);
    const state = readBootState(root, env);
    expect(state.bootConfirmed.head).toBe('abc123');
    expect(state.attempts).toEqual([]);
  });
});

describe('runSupervisedStart — every IO edge injected, no real process/git', () => {
  let stateDir; let root; let env;
  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'daemon-boot-supervised-'));
    root = join(tmpdir(), 'fake-clone-for-supervised-start');
    env = { WE_DAEMON_STATE_DIR: stateDir };
  });
  afterEach(() => { rmSync(stateDir, { recursive: true, force: true }); });

  const fakeRun = (head) => () => ({ status: 0, stdout: head, stderr: '' });

  it('a fresh clean history spawns and, on survival past the window, records the current head as boot-confirmed', async () => {
    let spawned = false;
    const spawnFn = () => { spawned = true; return { child: {}, exited: new Promise(() => {}) }; }; // never exits
    const result = await runSupervisedStart({
      root, entry: 'entry.mjs', env, thresholdMs: 20, countThreshold: 3, spawnFn, run: fakeRun('sha-good\n'), log: { error: () => {} },
    });
    expect(spawned).toBe(true);
    expect(result.started).toBe(true);
    expect(result.survived).toBe(true);
    expect(readBootState(root, env).bootConfirmed).toEqual({ head: 'sha-good', at: expect.any(String) });
  });

  it('a fast exit is recorded as an attempt, never confirmed', async () => {
    const spawnFn = () => ({ child: {}, exited: Promise.resolve({ exitedAt: Date.now(), code: 1 }) });
    const result = await runSupervisedStart({
      root, entry: 'entry.mjs', env, thresholdMs: 5000, countThreshold: 3, spawnFn, run: fakeRun('sha-bad\n'), log: { error: () => {} },
    });
    expect(result.started).toBe(true);
    expect(result.survived).toBe(false);
    const state = readBootState(root, env);
    expect(state.attempts).toHaveLength(1);
    expect(state.bootConfirmed).toBeNull();
  });

  it('K consecutive fast exits on record trip the guard BEFORE the next spawn, and revert to the last boot-confirmed sha', async () => {
    recordBootConfirmed(root, { head: 'sha-known-good' }, env);
    for (let i = 0; i < 3; i += 1) appendBootAttempt(root, { startedAt: i * 1000, exitedAt: i * 1000 + 50, head: 'sha-broken' }, { env });
    let spawned = false;
    const spawnFn = () => { spawned = true; return { child: {}, exited: new Promise(() => {}) }; };
    let revertedTo = null;
    const rollback = ({ root: r, sha }) => { revertedTo = { root: r, sha }; return { ok: true }; };
    const result = await runSupervisedStart({
      root, entry: 'entry.mjs', env, thresholdMs: 15_000, countThreshold: 3, spawnFn, run: fakeRun('irrelevant\n'), rollback, log: { error: () => {} },
    });
    expect(spawned).toBe(false); // never spawns onto known-broken code without reverting first
    expect(result.started).toBe(false);
    expect(revertedTo).toEqual({ root, sha: 'sha-known-good' });
    expect(readBootState(root, env).attempts).toEqual([]); // cleared so the next attempt starts a fresh streak
  });

  it('a failed revert leaves the attempt history intact (never silently cleared over an unresolved break)', async () => {
    for (let i = 0; i < 3; i += 1) appendBootAttempt(root, { startedAt: i * 1000, exitedAt: i * 1000 + 50, head: 'sha-broken' }, { env });
    const rollback = () => ({ ok: false, reason: 'dirty' });
    const result = await runSupervisedStart({
      root, entry: 'entry.mjs', env, thresholdMs: 15_000, countThreshold: 3, spawnFn: () => { throw new Error('must not spawn'); }, run: fakeRun('x\n'), rollback, log: { error: () => {} },
    });
    expect(result.started).toBe(false);
    expect(result.reverted.ok).toBe(false);
    expect(readBootState(root, env).attempts).toHaveLength(3);
  });

  // #4468 review — a crash loop that trips before ANY start of this clone ever survived has no boot-confirmed
  // sha to revert to at all. `rollbackToSha` itself already refuses `sha:null` (`{ok:false, reason:'no-sha'}`,
  // covered by that file's own suite) — this pins that `runSupervisedStart` reaches it with exactly that shape,
  // never spawns, and never fabricates a target.
  it('a crash loop with NO boot-confirmed sha on record calls rollback with sha:null and never spawns', async () => {
    for (let i = 0; i < 3; i += 1) appendBootAttempt(root, { startedAt: i * 1000, exitedAt: i * 1000 + 50, head: 'sha-broken' }, { env });
    let spawned = false;
    const spawnFn = () => { spawned = true; return { child: {}, exited: new Promise(() => {}) }; };
    let calledWith = null;
    const rollback = (o) => { calledWith = o; return { ok: false, reason: 'no-sha' }; };
    const result = await runSupervisedStart({
      root, entry: 'entry.mjs', env, thresholdMs: 15_000, countThreshold: 3, spawnFn, run: fakeRun('irrelevant\n'), rollback, log: { error: () => {} },
    });
    expect(spawned).toBe(false);
    expect(calledWith).toMatchObject({ root, sha: null });
    expect(result.started).toBe(false);
    expect(result.reverted).toMatchObject({ target: null, ok: false, reason: 'no-sha' });
    expect(readBootState(root, env).attempts).toHaveLength(3); // never cleared over an unresolved break
  });

  // #4468 review — asserting a bare call-COUNT equality on the GLOBAL `setTimeout`/`clearTimeout` is fragile:
  // anything else in the process (runner internals, fs/child machinery) calling either global during the test
  // skews the count and can flake with no real regression. This instead identifies THIS function's own two
  // timers by their distinctive delays (10ms / 5000ms — chosen so no unrelated call in this narrow window is
  // remotely likely to share either) and confirms each SPECIFIC handle `setTimeout` returned was itself the
  // one passed to `clearTimeout` — never just that clearTimeout was called some matching number of times.
  it('the survival timer is cleared BY ITS OWN HANDLE, never leaving a lingering timer, on BOTH the survived and the fast-exit path', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const survivedSpawn = () => ({ child: {}, exited: new Promise(() => {}) });
    await runSupervisedStart({ root, entry: 'entry.mjs', env, thresholdMs: 10, countThreshold: 3, spawnFn: survivedSpawn, run: fakeRun('h\n'), log: { error: () => {} } });
    const fastSpawn = () => ({ child: {}, exited: Promise.resolve({ exitedAt: Date.now(), code: 1 }) });
    await runSupervisedStart({ root, entry: 'entry.mjs', env, thresholdMs: 5000, countThreshold: 3, spawnFn: fastSpawn, run: fakeRun('h\n'), log: { error: () => {} } });

    const ownSetTimeoutCalls = setTimeoutSpy.mock.calls
      .map((args, i) => ({ delayMs: args[1], handle: setTimeoutSpy.mock.results[i].value }))
      .filter((c) => c.delayMs === 10 || c.delayMs === 5000);
    expect(ownSetTimeoutCalls).toHaveLength(2); // one per runSupervisedStart call above
    const clearedHandles = new Set(clearTimeoutSpy.mock.calls.map((args) => args[0]));
    for (const { handle } of ownSetTimeoutCalls) expect(clearedHandles.has(handle)).toBe(true);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
