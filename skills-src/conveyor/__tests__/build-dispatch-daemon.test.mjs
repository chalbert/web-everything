import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runBuildDispatchTick, settleBookkeeping, readKillSwitch, readDispatchOutcome, KILL_SWITCH_ENV,
  cliListSettledBuilds, cliListHolds, policyFrom,
} from '../build-dispatch-daemon.mjs';
import {
  acquireBuildDispatchClaim, releaseBuildDispatchClaim, listBuildDispatchClaims,
  placeBuildDispatchHold, listBuildDispatchHolds,
} from '../../../scripts/conveyor/build-dispatch-claim.mjs';
import { BUILD_DISPATCH_POLICY } from '../../../scripts/conveyor/build-dispatch-policy.mjs';
import { createFileRunStore, newRunRecord } from '../../../scripts/operations/run-store.mjs';
import { DISPATCH_EFFECT } from '../../../scripts/operations/dispatch-lane.mjs';

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

  /** A fake tick-core answer with `n` freshly-proposed spawns and a caller-supplied `counts`. */
  function manySpawnsTick(n, counts) {
    const spawnBuilds = Array.from({ length: n }, (_, i) => ({ num: String(200 + i), lane: i + 1 }));
    // Each candidate needs its OWN, disjoint scope — an empty scope is held `scope-vs-open-prs` (unprovable
    // disjointness from open PRs) before the cap is ever reached, which would mask the count this test targets.
    const scopeFor = (num) => [`plateau-app:src/scratch-${num}.ts`];
    return {
      decisions: {
        statusLine: 'test',
        counts,
        spawnBuilds,
        admission: {
          queue: spawnBuilds.map((s) => ({ num: s.num, scope: scopeFor(s.num) })),
          cleared: spawnBuilds.map((s) => ({ num: s.num, ready: true })),
        },
      },
      nextState: {},
    };
  }
  const noInFlightEffects = (planTick) => ({
    planTick,
    fetchOpenPrs: () => [{ repo: 'plateau-app', prs: [] }],
    listClaims: () => [],
    releaseClaim: () => {},
    acquireClaim: () => ({ ok: true }),
    listRunStoreInFlight: () => [],
    killSwitch: () => ({ engaged: false }),
    dispatch: () => ({ dispatching: true, lane: 1 }),
  });

  it('card x0jgunh — reads counts.buildingInFlight (not counts.building) for the cap: 6 freshly-proposed spawns with buildingInFlight:0 still admit up to the cap', async () => {
    const policy = { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: 3 };
    const r = await runBuildDispatchTick({
      live: false,
      policy,
      effects: noInFlightEffects(() => manySpawnsTick(6, { building: 6, buildingInFlight: 0 })),
    });
    // Before the fix, `externalBuilding` read `counts.building` (6) and the cap (3) held ALL 6 candidates —
    // `plan.dispatch.length` was 0. With `buildingInFlight` (0 — nothing was ACTUALLY in flight before this
    // tick's own proposals), the daemon admits up to its own cap instead.
    expect(r.plan.dispatch.length).toBe(3);
  });

  it('control: an older planTick stub with no counts.buildingInFlight still falls back to counts.building (unchanged behavior for a caller that has not been updated)', async () => {
    const policy = { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: 3 };
    const r = await runBuildDispatchTick({
      live: false,
      policy,
      effects: noInFlightEffects(() => manySpawnsTick(6, { building: 6 })),
    });
    expect(r.plan.dispatch.length).toBe(0);
  });

  // #4353 — open-item WIP cap wiring: the CLI flag → policy, and the tick's real pipeline surfacing `plan.openItems`.
  it('policyFrom threads --max-open-items into the policy the same mechanical way --max-concurrent/--max-open-prs already do', () => {
    const policy = policyFrom({ 'max-concurrent': '4', 'max-open-prs': '20', 'max-open-items': '9' });
    expect(policy.maxConcurrentBuilds).toBe(4);
    expect(policy.maxOpenPrs).toBe(20);
    expect(policy.maxOpenItems).toBe(9);
    // an omitted flag falls back to the declared policy default, same as the pre-existing two flags
    expect(policyFrom({}).maxOpenItems).toBe(BUILD_DISPATCH_POLICY.maxOpenItems);
  });

  it('runBuildDispatchTick surfaces plan.openItems from real openPrs, and holds a fresh candidate once it is full — naming which item fills it', async () => {
    const dispatches = [];
    const openPrs = [{ number: 50, headRefName: 'lane/500-x', labels: [], files: [] }];
    const policy = { ...BUILD_DISPATCH_POLICY, maxOpenItems: 1 };
    const r = await runBuildDispatchTick({ live: false, policy, effects: effectsFor({ lockRoot, pid: 1, dispatches, openPrs }) });
    expect(r.plan.openItems).toEqual({ count: 1, cap: 1, nums: ['500'] });
    expect(r.plan.hold.filter((h) => h.rule === 'wip-cap').map((h) => h.num)).toEqual(['3827', '2662']);
    expect(r.plan.hold.find((h) => h.rule === 'wip-cap').reason).toMatch(/500/);
    // this card must never touch the pre-existing display-only field — still the raw durable in-flight list.
    expect(r.plan.inFlight).toEqual([]);
  });
});

// #4349 — a finished delivery wrapper now settles its own run-store effect and releases/holds the
// build-dispatch claim (see `deliver-item-wrapper.mjs`/`deliver-item-settle.mjs`); THIS daemon-side half is
// what actually stops the item from being re-dispatched: a settled, non-PR outcome retires a stale claim, and
// a held item is excluded from the next tick's candidates entirely.
describe('runBuildDispatchTick — #4349 settled-outcome claim retirement + holds', () => {
  let lockRoot;
  let holdRoot;
  beforeEach(() => {
    lockRoot = mkdtempSync(join(tmpdir(), 'bdd-claims-'));
    holdRoot = mkdtempSync(join(tmpdir(), 'bdd-holds-'));
  });
  afterEach(() => {
    rmSync(lockRoot, { recursive: true, force: true });
    rmSync(holdRoot, { recursive: true, force: true });
  });

  /** One item, cleared and queued, never freshly proposed for spawn (isolates the retirement logic from the
   *  dispatch-policy cap math the other describe block already covers). */
  const oneItemNoSpawnTick = () => ({
    decisions: {
      statusLine: 'test',
      counts: { building: 0, buildingInFlight: 0 },
      spawnBuilds: [],
      admission: {
        queue: [{ num: '9001', scope: ['we:scripts/x.mjs'] }],
        cleared: [{ num: '9001', ready: true }],
      },
    },
    nextState: {},
  });

  function baseEffects({ settledBuilds = [], runStoreInFlight = [], holds = [] } = {}) {
    return {
      planTick: () => oneItemNoSpawnTick(),
      fetchOpenPrs: () => [{ repo: 'we', prs: [] }],
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      acquireClaim: ({ num, scope }) => acquireBuildDispatchClaim({ num, scope, lockRoot }),
      listRunStoreInFlight: () => runStoreInFlight,
      listSettledBuilds: () => settledBuilds,
      listHolds: () => holds,
      killSwitch: () => ({ engaged: false }),
      dispatch: () => ({ dispatching: true, lane: 1 }),
    };
  }

  it('Done-when 3 — a stale claim whose run record settled with a non-PR outcome is retired, and the next '
    + 'tick does not count the item as building', async () => {
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['9001']);
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({ settledBuilds: [{ num: '9001', outcome: 'gate-red' }] }),
    });
    expect(r.retired).toEqual([expect.objectContaining({ num: '9001', released: true })]);
    expect(r.plan.inFlight).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('a settled `pr-opened` outcome is NOT retired here — the PR-observed path owns that', async () => {
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({ settledBuilds: [{ num: '9001', outcome: 'pr-opened' }] }),
    });
    expect(r.retired).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['9001']);
  });

  it('a stale SETTLED row from an older attempt never retires a NEWER attempt\'s claim while that newer '
    + 'attempt is still genuinely in-flight', async () => {
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({
        settledBuilds: [{ num: '9001', outcome: 'gate-red' }], // an OLD attempt's stale settled row
        runStoreInFlight: [{ num: '9001', scope: [], source: 'run dispatch-lane-newer' }], // a NEWER, live one
      }),
    });
    expect(r.retired).toEqual([]);
    // the newer attempt's own in-flight row must still be reported, not hidden by the stale settled row.
    expect(r.plan.inFlight).toEqual([expect.objectContaining({ num: '9001' })]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['9001']);
  });

  it('a stale SETTLED row from an OLDER attempt never retires a NEWER claim even before the new attempt\'s '
    + 'own run-store row exists at all — still `declared`, never reaching `listRunStoreInFlight`. The settled '
    + 'row\'s own `startedAt` predates the claim\'s `claimedAt`, so it is recognised as belonging to the OLD '
    + 'attempt this claim already superseded', async () => {
    const oldAttemptStartedAt = new Date(Date.now() - 5 * 60 * 60_000).toISOString(); // 5h ago
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot }); // the CURRENT, newer claim
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({
        settledBuilds: [{ num: '9001', outcome: 'gate-red', startedAt: oldAttemptStartedAt }],
      }),
    });
    expect(r.retired).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['9001']);
  });

  it('a settled row whose `startedAt` is AT OR AFTER the current claim\'s `claimedAt` DOES retire it — a '
    + 'genuinely fresh attempt that failed fast, before ever reaching `in-flight`', async () => {
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    const { claimedAt } = listBuildDispatchClaims({ lockRoot })[0].meta;
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({
        settledBuilds: [{ num: '9001', outcome: 'gate-red', startedAt: claimedAt }],
      }),
    });
    expect(r.retired).toEqual([expect.objectContaining({ num: '9001', released: true })]);
    expect(listBuildDispatchClaims({ lockRoot })).toEqual([]);
  });

  it('with two settled rows for the same item, the NEWEST by `startedAt` wins — never "whichever the source '
    + 'returned last": a stale `pr-opened` row listed AFTER a newer real failure must not hide it', async () => {
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    const { claimedAt } = listBuildDispatchClaims({ lockRoot })[0].meta;
    const older = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
    const r = await runBuildDispatchTick({
      live: true,
      effects: baseEffects({
        settledBuilds: [
          { num: '9001', outcome: 'gate-red', startedAt: claimedAt }, // the real, newer failure — listed FIRST
          { num: '9001', outcome: 'pr-opened', startedAt: older }, // a stale row — listed LAST
        ],
      }),
    });
    expect(r.retired).toEqual([expect.objectContaining({ num: '9001', released: true, why: 'run record settled: gate-red' })]);
  });

  it('a held item is excluded from this tick\'s candidates entirely (the re-dispatch-loop fix)', async () => {
    placeBuildDispatchHold({ num: '9001', reason: 'not-ready (blockedBy 1 re-opened)', lockRoot: holdRoot });
    const spawnableTick = () => ({
      decisions: {
        statusLine: 'test',
        counts: { building: 0, buildingInFlight: 0 },
        spawnBuilds: [{ num: '9001', lane: 1 }],
        admission: {
          queue: [{ num: '9001', scope: ['we:scripts/x.mjs'] }],
          cleared: [{ num: '9001', ready: true }],
        },
      },
      nextState: {},
    });
    const r = await runBuildDispatchTick({
      live: false,
      effects: {
        ...baseEffects({
          holds: listBuildDispatchHolds({ lockRoot: holdRoot }).map((h) => ({ num: h.meta.num, reason: h.meta.reason })),
        }),
        planTick: spawnableTick,
      },
    });
    expect(r.dispatchHolds).toEqual(['9001']);
    expect(r.plan.dispatch).toEqual([]);
    expect(r.plan.hold.find((h) => h.num === '9001')).toBeUndefined();
  });

  it('an effects stub with neither `listSettledBuilds` nor `listHolds` (predates #4349) behaves exactly as '
    + 'before — no retirement, no exclusion', async () => {
    const legacyEffects = {
      planTick: () => oneItemNoSpawnTick(),
      fetchOpenPrs: () => [{ repo: 'we', prs: [] }],
      listClaims: () => listBuildDispatchClaims({ lockRoot }),
      releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot }),
      acquireClaim: ({ num, scope }) => acquireBuildDispatchClaim({ num, scope, lockRoot }),
      listRunStoreInFlight: () => [],
      killSwitch: () => ({ engaged: false }),
      dispatch: () => ({ dispatching: true, lane: 1 }),
    };
    acquireBuildDispatchClaim({ num: '9001', scope: [], lockRoot });
    const r = await runBuildDispatchTick({ live: true, effects: legacyEffects });
    expect(r.retired).toEqual([]);
    expect(r.dispatchHolds).toEqual([]);
    expect(listBuildDispatchClaims({ lockRoot }).map((c) => c.meta.num)).toEqual(['9001']);
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

// ================================================================================================
// `cliListSettledBuilds`/`cliListHolds` are the REAL readers `runBuildDispatchTick`'s own tests above only ever
// exercise through a hand-fed stub (`effectsFor`'s `listSettledBuilds`/`listHolds`). These drive the real
// functions against a real temp run-store / coordination root instead, so the applied/failed-only filter, the
// `outcome ?? 'wrapper-failed'` fallback, and the real hold reader are each proven against actual on-disk state.
// ================================================================================================
describe('cliListSettledBuilds / cliListHolds (the real readers, not a stub)', () => {
  let runsDir;
  let coordRoot;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'bdd-runs-'));
    coordRoot = mkdtempSync(join(tmpdir(), 'bdd-coord-'));
    process.env.OPERATION_RUNS_DIR = runsDir;
    process.env.WE_COORDINATION_ROOT = coordRoot;
  });

  afterEach(() => {
    delete process.env.OPERATION_RUNS_DIR;
    delete process.env.WE_COORDINATION_ROOT;
    rmSync(runsDir, { recursive: true, force: true });
    rmSync(coordRoot, { recursive: true, force: true });
  });

  function seedRun(id, effects) {
    const store = createFileRunStore(runsDir);
    store.write({ ...newRunRecord({ id, op: 'dispatch-lane' }), pending: null, effects });
    return store;
  }

  it('lists an `applied` build effect under the OUTCOME the wrapper actually settled it with', async () => {
    seedRun('dispatch-lane-1001', [{
      key: 'dispatch:0:0', type: DISPATCH_EFFECT, stepIndex: 0, index: 0, status: 'applied',
      payload: { num: '1001', launchKind: 'build' }, result: { outcome: 'not-ready', reason: 'blockedBy 1 re-opened' }, error: null,
    }]);
    const rows = await cliListSettledBuilds();
    expect(rows).toEqual([expect.objectContaining({ num: '1001', outcome: 'not-ready', source: 'run dispatch-lane-1001' })]);
  });

  it('carries the effect\'s own `startedAt` through — the ordering key `runBuildDispatchTick` uses to tell a '
    + 'fresh attempt\'s settle apart from an older, already-superseded one for the same item', async () => {
    seedRun('dispatch-lane-1005', [{
      key: 'dispatch:0:0', type: DISPATCH_EFFECT, stepIndex: 0, index: 0, status: 'applied',
      startedAt: '2026-01-01T00:00:00.000Z',
      payload: { num: '1005', launchKind: 'build' }, result: { outcome: 'gate-red' }, error: null,
    }]);
    const rows = await cliListSettledBuilds();
    expect(rows).toEqual([{ num: '1005', outcome: 'gate-red', source: 'run dispatch-lane-1005', startedAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('falls back to the literal `wrapper-failed` for a `failed` entry with no `result` — an exception the '
    + 'wrapper caught but never got far enough to classify', async () => {
    seedRun('dispatch-lane-1002', [{
      key: 'dispatch:0:0', type: DISPATCH_EFFECT, stepIndex: 0, index: 0, status: 'failed',
      payload: { num: '1002', launchKind: 'build' }, result: null, error: 'lane pool exhausted',
    }]);
    const rows = await cliListSettledBuilds();
    expect(rows).toEqual([expect.objectContaining({ num: '1002', outcome: 'wrapper-failed', source: 'run dispatch-lane-1002' })]);
  });

  it('excludes an `in-flight` build effect (not yet settled) and a non-build launchKind effect', async () => {
    seedRun('dispatch-lane-1003', [
      {
        key: 'dispatch:0:0', type: DISPATCH_EFFECT, stepIndex: 0, index: 0, status: 'in-flight',
        payload: { num: '1003', launchKind: 'build' }, result: null, error: null,
      },
      {
        key: 'dispatch:0:1', type: DISPATCH_EFFECT, stepIndex: 0, index: 1, status: 'applied',
        payload: { num: '1004', launchKind: 'prepare' }, result: { outcome: 'done' }, error: null,
      },
    ]);
    expect(await cliListSettledBuilds()).toEqual([]);
  });

  it('cliListHolds reads a real, live hold placed via `placeBuildDispatchHold`, keyed by its own reason', () => {
    placeBuildDispatchHold({ num: '2001', reason: 'gate-red' });
    expect(cliListHolds()).toEqual([{ num: '2001', reason: 'gate-red' }]);
  });

  it('cliListHolds is empty with no holds placed', () => {
    expect(cliListHolds()).toEqual([]);
  });
});
