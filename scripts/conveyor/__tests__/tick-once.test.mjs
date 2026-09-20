/** #3383 — tick-once: every outcome has its own exit code; plan is read-only; apply claims and records. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTickOnceCommand, parseArgs, withCapturedOutput, EXIT } from '../tick-once.mjs';
import { createTickThrottle, DEFAULT_CLAIM_STALE_MS } from '../../operations/tick-throttle.mjs';
import { coordinationPaths } from '../../operations/coordination-root.mjs';
import { tryAcquireTickMutex } from '../../operations/tick-mutex.mjs';
import { CoordinationUnavailableError } from '../../operations/action-record.mjs';
import { WORKER_MARKER_ENV } from '../../operations/session-role.mjs';
import { runTickOnce, createTickCoordination } from '../../../skills-src/conveyor/runner.mjs';

const MIN = 60_000;
let clock, root, throttle, calls;
const throttleFor = (r = root, extra = {}) => createTickThrottle({ root: r, now: () => clock, minIntervalMs: MIN, newToken: (() => { let n = 0; return () => `t${++n}`; })(), isPidAlive: () => true, ...extra });
const okRun = (extra = {}) => vi.fn(async () => ({ ok: true, tickId: 'a#1', out: { decisions: { decisionTrace: [{ kind: 'dispatch', text: 'dispatched #1' }] }, nextState: {} }, ...extra }));
const command = (opts = {}) => runTickOnceCommand({ env: {}, now: () => clock, root, throttle, driverId: 'a', run: okRun(), buildEffects: () => ({}), createCoordination: () => ({}), ...opts });
beforeEach(() => { clock = 2_000_000; root = process.env.WE_COORDINATION_ROOT; throttle = throttleFor(); calls = []; });

describe('exit codes', () => {
  it('ticked (0): apply runs one tick and records a success', async () => {
    const run = okRun();
    const r = await command({ apply: true, run });
    expect(r).toMatchObject({ exitCode: 0, status: 'ticked', tickId: 'a#1' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8'))).toMatchObject({ claim: null, lastSuccess: { tickId: 'a#1' }, lastAttempt: { outcome: 'success' } });
    expect(r.lines).toEqual(['tick-once: ticked (apply, a#1)', '  dispatch: dispatched #1']);
  });
  it('throttled (10): a wakeup inside the min interval runs nothing; one after it ticks again', async () => {
    await command({ apply: true });
    clock += 1000;
    const run = okRun();
    expect(await command({ apply: true, run })).toMatchObject({ exitCode: 10, status: 'throttled', reason: 'throttled' });
    expect(run).not.toHaveBeenCalled();
    clock += MIN;
    expect((await command({ apply: true, run })).exitCode).toBe(0);
  });
  it('throttled (10): a tick already in flight coalesces the wakeup', async () => {
    throttle.claim({ owner: { driverId: 'other' } });
    const run = okRun();
    expect(await command({ apply: true, run })).toMatchObject({ exitCode: 10, reason: 'in-flight' });
    expect(run).not.toHaveBeenCalled();
  });
  it('skipped (11): a worker, or an unrecognised marker, never ticks and touches no file', async () => {
    for (const value of ['1', '0', '', 'true']) {
      const run = okRun();
      const r = await command({ apply: true, run, env: { [WORKER_MARKER_ENV]: value } });
      expect(r).toMatchObject({ exitCode: 11, status: 'skipped-not-orchestrator' });
      expect(run).not.toHaveBeenCalled();
    }
    expect(existsSync(coordinationPaths(root).tickThrottle)).toBe(false);
  });
  it('busy (12): the tick mutex is held; the attempt is recorded as failed and does not throttle the next wakeup', async () => {
    const r = await command({ apply: true, run: async () => ({ ok: false, reason: 'busy', heldBy: { driverId: 'z' } }) });
    expect(r).toMatchObject({ exitCode: 12, status: 'busy', reason: 'mutex-held' });
    const rec = JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8'));
    expect(rec).toMatchObject({ claim: null, lastSuccess: null, lastAttempt: { outcome: 'failed', reason: 'busy' } });
    expect((await command({ apply: true })).exitCode).toBe(0);
  });
  it('busy (12): an expired claim that cannot be proven dead is held', async () => {
    throttle.claim({ owner: { driverId: 'other' } });
    clock += DEFAULT_CLAIM_STALE_MS + 1;
    const run = okRun();
    expect(await command({ apply: true, run })).toMatchObject({ exitCode: 12, reason: 'claim-unknown' });
    expect(run).not.toHaveBeenCalled();
  });
  it('unavailable (13): coordination or bookkeeping unreadable, a thrown CoordinationUnavailableError, or a corrupt throttle record', async () => {
    for (const reason of ['coordination-unavailable', 'bookkeeping-unavailable']) {
      expect((await command({ apply: true, run: async () => ({ ok: false, reason, error: 'x' }) })).exitCode).toBe(13);
    }
    expect((await command({ apply: true, run: async () => { throw new CoordinationUnavailableError('/p', new Error('io')); } })).exitCode).toBe(13);
    mkdirSync(root, { recursive: true });
    writeFileSync(coordinationPaths(root).tickThrottle, '{corrupt');
    const run = okRun();
    expect(await command({ apply: true, run })).toMatchObject({ exitCode: 13, status: 'coordination-unavailable' });
    expect(await command({ apply: false, run })).toMatchObject({ exitCode: 13 });
    expect(run).not.toHaveBeenCalled();
  });
  it('failed (14): a lost lease or a thrown error is an ATTEMPT, so the next wakeup is not throttled', async () => {
    for (const run of [async () => ({ ok: false, reason: 'lease-lost' }), async () => { throw new Error('boom'); }]) {
      expect(await command({ apply: true, run })).toMatchObject({ exitCode: 14, status: 'failed' });
      expect(JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8'))).toMatchObject({ claim: null, lastSuccess: null });
    }
    expect((await command({ apply: true })).exitCode).toBe(0);
  });
  it('every outcome has a distinct code', () => {
    expect(new Set(Object.values(EXIT)).size).toBe(Object.values(EXIT).length);
  });
});

describe('plan (default) versus apply', () => {
  const fixtureEffects = () => {
    const spies = { dispatchPass: vi.fn(async ({ out }) => ({ nextState: out.nextState })), mechanicalPasses: vi.fn(), emit: vi.fn(), reportCoordination: vi.fn() };
    const tickOnce = vi.fn(async (payload) => ({ decisions: { spawnBuilds: [{ num: 7, lane: 1 }], decisionTrace: [{ kind: 'dispatch', text: 'dispatched #7 to lane-1: build' }] },
      nextState: { tick: (payload.bookkeeping?.tick ?? 0) + 1, buildGuards: [], prepareGuards: [], fixGuards: [], ciHealGuards: [], fixAttempts: {}, ciHealAttempts: {}, watched: [], launchedNums: [7], heldStall: {} } }));
    const buildEffects = ({ plan }) => (plan ? { tickOnce } : { tickOnce, ...spies });
    const createCoordination = () => createTickCoordination({ root, now: () => clock, listAgents: async () => [], findEffect: async () => null, postconditionHolds: async () => false });
    return { spies, tickOnce, buildEffects, createCoordination };
  };
  it('plan runs the read-only core and reports the decisions, but claims, dispatches, passes and saves nothing', async () => {
    const f = fixtureEffects();
    const r = await command({ run: runTickOnce, buildEffects: f.buildEffects, createCoordination: f.createCoordination });
    expect(r).toMatchObject({ exitCode: 0, status: 'planned' });
    expect(r.lines).toEqual([expect.stringMatching(/^tick-once: would tick \(plan, /), '  dispatch: dispatched #7 to lane-1: build']);
    expect(f.tickOnce).toHaveBeenCalledTimes(1);
    for (const spy of Object.values(f.spies)) expect(spy).not.toHaveBeenCalled();
    expect(existsSync(coordinationPaths(root).tickThrottle)).toBe(false);
    expect(existsSync(coordinationPaths(root).bookkeeping)).toBe(false);
    expect(existsSync(coordinationPaths(root).tickMutex)).toBe(false);
    // Plan does not consume the throttle: a second plan gives the same answer.
    expect((await command({ run: runTickOnce, buildEffects: f.buildEffects })).exitCode).toBe(0);
  });
  it('plan honours the throttle without changing it', async () => {
    await command({ apply: true });
    const before = readFileSync(coordinationPaths(root).tickThrottle, 'utf8');
    clock += 100;
    expect(await command({ apply: false })).toMatchObject({ exitCode: 10, reason: 'throttled' });
    expect(readFileSync(coordinationPaths(root).tickThrottle, 'utf8')).toBe(before);
  });
  it('plan reads the persisted bookkeeping so it plans from the real state', async () => {
    const f = fixtureEffects();
    await command({ apply: true, run: runTickOnce, buildEffects: f.buildEffects, createCoordination: f.createCoordination });
    clock += MIN + 1;
    await command({ run: runTickOnce, buildEffects: f.buildEffects });
    expect(f.tickOnce.mock.calls.at(-1)[0].bookkeeping.tick).toBe(1); // saved by the apply run
    expect(JSON.parse(readFileSync(coordinationPaths(root).bookkeeping, 'utf8')).bookkeeping.tick).toBe(1); // and plan did not advance it
  });
  it('apply runs the mechanical passes and dispatch pass, publishes, saves bookkeeping and records the success', async () => {
    const f = fixtureEffects();
    const r = await command({ apply: true, run: runTickOnce, buildEffects: f.buildEffects, createCoordination: f.createCoordination });
    expect(r).toMatchObject({ exitCode: 0, status: 'ticked' });
    expect(f.spies.emit).toHaveBeenCalledTimes(1);
    expect(f.spies.mechanicalPasses).toHaveBeenCalledTimes(1);
    expect(f.spies.dispatchPass).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(coordinationPaths(root).bookkeeping, 'utf8')).bookkeeping.tick).toBe(1);
    expect(JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8')).lastSuccess.tickId).toBe(r.tickId);
  });
  it('a real tick mutex held by another driver makes apply busy (12), and the throttle is not spent', async () => {
    const f = fixtureEffects();
    expect(tryAcquireTickMutex({ root, owner: { driverId: 'other', pid: process.pid, host: hostname() }, tickId: 'o#1', now: () => clock, isPidAlive: () => true }).ok).toBe(true);
    const r = await command({ apply: true, run: runTickOnce, buildEffects: f.buildEffects, createCoordination: f.createCoordination });
    expect(r).toMatchObject({ exitCode: 12, reason: 'mutex-held' });
    expect(f.spies.dispatchPass).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(coordinationPaths(root).tickThrottle, 'utf8')).lastSuccess).toBeNull();
  });
});

describe('determinism', () => {
  it('the same clock, driver and effects give the same result and the same throttle record on fresh roots', async () => {
    const once = async () => {
      const r = mkdtempSync(join(tmpdir(), 'to-det-'));
      const result = await runTickOnceCommand({ apply: true, env: {}, now: () => clock, root: r, throttle: throttleFor(r), driverId: 'a', run: okRun(), buildEffects: () => ({}), createCoordination: () => ({}) });
      return { result, record: readFileSync(coordinationPaths(r).tickThrottle, 'utf8') };
    };
    const a = await once(), b = await once();
    expect(a).toEqual(b);
  });
});

describe('command line', () => {
  it('parseArgs accepts the four flags and refuses anything else', () => {
    expect(parseArgs(['--apply', '--verbose', '--min-interval-ms=5', '--repo=we'])).toEqual({ apply: true, verbose: true, 'min-interval-ms': '5', repo: 'we' });
    for (const bad of [['--nope'], ['apply'], ['--apply=1', 'x']]) expect(() => parseArgs(bad)).toThrow(TypeError);
  });
  it('withCapturedOutput swallows stdout and stderr and restores them', async () => {
    const before = [process.stdout.write, process.stderr.write];
    const { value, captured } = await withCapturedOutput(async () => { process.stdout.write('a'); process.stderr.write('b'); return 7; });
    expect(value).toBe(7);
    expect(captured).toEqual([{ stream: 'stdout', text: 'a' }, { stream: 'stderr', text: 'b' }]);
    expect([process.stdout.write, process.stderr.write]).toEqual(before);
  });
  const cli = (args, env = {}) => spawnSync(process.execPath, ['--no-warnings', 'scripts/conveyor/tick-once.mjs', ...args], {
    encoding: 'utf8', env: { PATH: process.env.PATH, WE_COORDINATION_ROOT: root, ...env } });
  it('as a process: silent by default, with the exit code as the whole answer (worker => 11)', () => {
    const r = cli([], { [WORKER_MARKER_ENV]: '1' });
    expect([r.status, r.stdout, r.stderr]).toEqual([11, '', '']);
    expect(existsSync(coordinationPaths(root).tickThrottle)).toBe(false);
  });
  it('as a process: --verbose prints the outcome line', () => {
    const r = cli(['--verbose'], { [WORKER_MARKER_ENV]: '1' });
    expect(r.status).toBe(11);
    expect(r.stdout).toBe('tick-once: skipped (worker: WE_CONVEYOR_WORKER=1)\n');
  });
  it('as a process: a bad flag or bad interval is a usage error (2)', () => {
    expect(cli(['--bogus']).status).toBe(2);
    expect(cli([], { WE_TICK_MIN_INTERVAL_MS: 'soon' }).status).toBe(2);
    expect(cli(['--min-interval-ms=-5']).status).toBe(2);
  });
  it('as a process: a corrupt throttle record is unavailable (13) and silent', () => {
    mkdirSync(root, { recursive: true });
    writeFileSync(coordinationPaths(root).tickThrottle, '{corrupt');
    const r = cli([]);
    expect([r.status, r.stdout, r.stderr]).toEqual([13, '', '']);
  });
});
