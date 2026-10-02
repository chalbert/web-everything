import { it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planningRead, PLANNING_SNAPSHOT_ENV } from '../planning-snapshot.mjs';
import { createPhaseTimer } from '../phase-timer.mjs';
import { cliPlanTick, runBuildDispatchTick } from '../../../skills-src/conveyor/build-dispatch-daemon.mjs';

it('shares successful planning observations, separates pools/rounds, and never caches launch effects', async () => {
  const dirs = [mkdtempSync(join(tmpdir(), 'plan-test-')), mkdtempSync(join(tmpdir(), 'plan-test-'))];
  try {
    const read = vi.fn(async () => ({ lanes: [read.mock.calls.length] }));
    const args = ['/repo/scripts/lane-pool.mjs', 'status', '--leased-only', '--json'];
    const io = { env: { [PLANNING_SNAPSHOT_ENV]: dirs[0] } };
    expect(await planningRead(args, read, io)).toEqual({ lanes: [1] });
    expect(planningRead(args, read, io)).toEqual({ lanes: [1] });
    await planningRead([...args, '--repo=fui'], read, io);
    await planningRead(args, read, { env: { [PLANNING_SNAPSHOT_ENV]: dirs[1] } });
    for (let i = 0; i < 2; i++) await planningRead(['/repo/scripts/lane-pool.mjs', 'acquire'], read, io);
    expect(read).toHaveBeenCalledTimes(5);
    const failure = vi.fn(() => { throw new Error('read failed'); });
    for (let i = 0; i < 2; i++) expect(() => planningRead([...args, '--repo=bad'], failure, io)).toThrow('read failed');
    expect(failure).toHaveBeenCalledTimes(2);
    await expect(planningRead([...args, '--repo=async-bad'], () => Promise.reject(new Error('async failed')), io)).rejects.toThrow('async failed');
    expect(planningRead([...args, '--repo=async-bad'], () => ({ lanes: [] }), io)).toEqual({ lanes: [] });
  } finally { dirs.forEach(d => rmSync(d, { recursive: true, force: true })); }
});

it('phase timing includes sync work, asynchronous failures and total overhead without changing results', async () => {
  let clock = 0;
  const timer = createPhaseTimer({ now: () => clock });
  const effects = timer.wrap({ sync: () => { clock += 10; return 7; }, async fail() { clock += 20; throw new Error('failed'); } });
  expect(effects.sync()).toBe(7);
  await expect(effects.fail()).rejects.toThrow('failed');
  clock += 5;
  expect(timer.snapshot()).toEqual({ totalMs: 35, phases: { sync: { ms: 10, calls: 1 }, fail: { ms: 20, calls: 1 } } });
});

it('owns a fresh private snapshot only for planning, and cleans up on success and failure', () => {
  const dirs = [];
  const exec = (_command, _args, opts) => {
    const dir = opts.env[PLANNING_SNAPSHOT_ENV];
    dirs.push(dir);
    expect(existsSync(dir)).toBe(true);
    if (dirs.length === 2) throw new Error('planner failed');
    return '{}';
  };
  expect(cliPlanTick({}, { exec })).toEqual({});
  expect(() => cliPlanTick({}, { exec })).toThrow('planner failed');
  expect(new Set(dirs).size).toBe(2);
  expect(dirs.every(dir => !existsSync(dir))).toBe(true);
});

it('keeps phase evidence when a real tick effect fails', async () => {
  const error = new Error('planner failed');
  const caught = await runBuildDispatchTick({ effects: { planTick: () => { throw error; } } }).catch(e => e);
  expect(caught).toBe(error);
  expect(caught.timings.phases.planTick.calls).toBe(1);
  expect(caught.timings.totalMs).toBeGreaterThanOrEqual(0);
});
