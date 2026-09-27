import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runBuildDispatchTick, settleBookkeeping, readKillSwitch, readDispatchOutcome, KILL_SWITCH_ENV,
} from '../build-dispatch-daemon.mjs';
import {
  acquireBuildDispatchClaim, releaseBuildDispatchClaim, listBuildDispatchClaims,
} from '../../../scripts/conveyor/build-dispatch-claim.mjs';

/** A tick-core answer: both items cleared + queued, both launchable, both on the SAME file. */
function sameFileTick(prev = {}) {
  const tick = prev.tick ?? 0;
  const scope = ['plateau-app:src/main.ts'];
  return {
    decisions: {
      statusLine: 'test',
      counts: { building: 0 },
      spawnBuilds: [{ num: '3827', lane: 13 }, { num: '2662', lane: 14 }],
      admission: {
        queue: [{ num: '3827', scope }, { num: '2662', scope: [...scope, 'plateau-app:src/x.ts'] }],
        cleared: [{ num: '3827', ready: true }, { num: '2662', ready: true }],
      },
    },
    nextState: {
      tick: tick + 1,
      buildGuards: [...(prev.buildGuards || []), { num: '3827', lane: 13, spawnedTick: tick }, { num: '2662', lane: 14, spawnedTick: tick }],
      launchedNums: [...(prev.launchedNums || []), '3827', '2662'],
    },
  };
}

/** Real claim module over a temp lock root; `pid` stands in for the daemon process (a restart = new pid). */
function effectsFor({ lockRoot, pid, dispatches, openPrs = [] }) {
  const owner = `testhost:${pid}`;
  return {
    planTick: (bk) => sameFileTick(bk),
    fetchOpenPrs: () => [{ repo: 'plateau-app', prs: openPrs }],
    listClaims: () => listBuildDispatchClaims({ lockRoot }),
    releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
    acquireClaim: ({ num, scope }) => acquireBuildDispatchClaim({ num, scope, owner, pid, lockRoot }),
    listRunStoreInFlight: () => [],
    killSwitch: () => ({ engaged: false }),
    dispatch: ({ num }) => { dispatches.push({ num, pid }); return { dispatching: true, lane: 13 }; },
  };
}

describe('runBuildDispatchTick', () => {
  let lockRoot;
  beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'bdd-claims-')); });
  afterEach(() => { rmSync(lockRoot, { recursive: true, force: true }); });

  it('restart + two ready cards on the same file → only one is ever dispatched', async () => {
    const dispatches = [];
    // Process A: first tick dispatches #3827; #2662 is held on the hot file within the same tick.
    const a = await runBuildDispatchTick({ live: true, effects: effectsFor({ lockRoot, pid: 1001, dispatches }) });
    expect(a.dispatched.map((d) => d.num)).toEqual(['3827']);
    expect(a.plan.hold).toEqual([expect.objectContaining({ num: '2662', rule: 'hot-file' })]);
    // Restart: a NEW process with EMPTY bookkeeping (the tick core's guards are gone) ticks again.
    const b = await runBuildDispatchTick({ bookkeeping: {}, live: true, effects: effectsFor({ lockRoot, pid: 2002, dispatches }) });
    expect(b.dispatched).toEqual([]);
    expect(b.plan.hold.find((h) => h.num === '3827')).toMatchObject({ rule: 'in-flight' });
    expect(b.plan.hold.find((h) => h.num === '2662')).toMatchObject({ rule: 'hot-file' });
    // And a third tick in the restarted process stays at one.
    await runBuildDispatchTick({ bookkeeping: b.nextBookkeeping, live: true, effects: effectsFor({ lockRoot, pid: 2002, dispatches }) });
    expect(dispatches).toEqual([{ num: '3827', pid: 1001 }]);
  });

  it('control: WITHOUT the durable claim, the same restart dispatches #3827 twice', async () => {
    const dispatches = [];
    const noClaims = (pid) => ({
      ...effectsFor({ lockRoot, pid, dispatches }),
      listClaims: () => [], acquireClaim: () => ({ ok: true }), releaseClaim: () => {},
    });
    await runBuildDispatchTick({ live: true, effects: noClaims(1001) });
    await runBuildDispatchTick({ bookkeeping: {}, live: true, effects: noClaims(2002) });
    expect(dispatches.map((d) => d.num)).toEqual(['3827', '3827']);
  });

  it('retires the claim once a PR delivers the item, freeing the hot file for the next card', async () => {
    const dispatches = [];
    await runBuildDispatchTick({ live: true, effects: effectsFor({ lockRoot, pid: 1, dispatches }) });
    const openPrs = [{ number: 42, headRefName: 'lane/3827-return-to', labels: [], files: [{ path: 'src/return-to.ts' }] }];
    const r = await runBuildDispatchTick({ live: true, effects: effectsFor({ lockRoot, pid: 2, dispatches, openPrs }) });
    expect(r.retired).toEqual([expect.objectContaining({ num: '3827', released: true })]);
    expect(r.dispatched.map((d) => d.num)).toEqual(['2662']);
  });

  it('an empty queue read never retires claims', async () => {
    const dispatches = [];
    await runBuildDispatchTick({ live: true, effects: effectsFor({ lockRoot, pid: 1, dispatches }) });
    const empty = { ...effectsFor({ lockRoot, pid: 2, dispatches }), planTick: () => ({ decisions: { admission: { queue: [], cleared: [] } }, nextState: {} }) };
    const r = await runBuildDispatchTick({ live: true, effects: empty });
    expect(r.retired).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['3827']);
  });

  it('dry run claims and dispatches nothing', async () => {
    const dispatches = [];
    const r = await runBuildDispatchTick({ live: false, effects: effectsFor({ lockRoot, pid: 1, dispatches }) });
    expect(r.plan.dispatch.map((d) => d.num)).toEqual(['3827']);
    expect(dispatches).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('releases the claim when dispatch-lane does not dispatch', async () => {
    const dispatches = [];
    const eff = { ...effectsFor({ lockRoot, pid: 1, dispatches }), dispatch: () => ({ dispatching: false, reason: 'suppressed' }) };
    const r = await runBuildDispatchTick({ live: true, effects: eff });
    expect(r.failures).toEqual([expect.objectContaining({ num: '3827', stage: 'dispatch' })]);
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('carries only the guards of builds it actually launched', async () => {
    const dispatches = [];
    const r = await runBuildDispatchTick({ live: true, effects: effectsFor({ lockRoot, pid: 1, dispatches }) });
    expect(r.nextBookkeeping.buildGuards.map((g) => g.num)).toEqual(['3827']);
    expect(r.nextBookkeeping.launchedNums).toEqual(['3827']);
  });
});

describe('settleBookkeeping', () => {
  it('keeps prior guards, drops new unexecuted ones across every guard list', () => {
    const prev = { buildGuards: [{ num: '1', lane: 3, spawnedTick: 0 }], prepareGuards: [], launchedNums: ['1'] };
    const next = {
      tick: 2,
      buildGuards: [{ num: '1', lane: 3, spawnedTick: 0 }, { num: '2', lane: 4, spawnedTick: 1 }, { num: '5', lane: 6, spawnedTick: 1 }],
      prepareGuards: [{ num: '9', kind: 'prepare', lane: 7, spawnedTick: 1 }],
      launchedNums: ['1', '2', '5', '9'],
    };
    const out = settleBookkeeping(prev, next, ['5']);
    expect(out.tick).toBe(2);
    expect(out.buildGuards.map((g) => g.num)).toEqual(['1', '5']);
    expect(out.prepareGuards).toEqual([]);
    expect(out.launchedNums).toEqual(['1', '5']);
  });
});

describe('kill switch + dispatch outcome', () => {
  it('reads the env flag and the kill file', () => {
    expect(readKillSwitch({ env: {} }).engaged).toBe(false);
    expect(readKillSwitch({ env: { [KILL_SWITCH_ENV]: '0' } }).engaged).toBe(false);
    expect(readKillSwitch({ env: { [KILL_SWITCH_ENV]: '1' } }).engaged).toBe(true);
    expect(readKillSwitch({ env: {}, killFileExists: true, killFilePath: '/k' })).toEqual({ engaged: true, reason: 'kill file /k' });
  });
  it('finds the nested dispatch verdict and fails closed on junk', () => {
    expect(readDispatchOutcome(JSON.stringify({ run: { verdict: { dispatching: true, lane: 3 } } }))).toMatchObject({ dispatching: true, lane: 3 });
    expect(readDispatchOutcome('not json').dispatching).toBe(false);
    expect(readDispatchOutcome('{}').dispatching).toBe(false);
  });
});
