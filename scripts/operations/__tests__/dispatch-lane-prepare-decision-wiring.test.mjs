/**
 * @file dispatch-lane-prepare-decision-wiring.test.mjs — #3644: the `prepare-decision` dispatch runs the
 * PREPARE-DECISION WRAPPER, mechanically, BY DEFAULT.
 *
 * WHAT THIS FILE PROVES, and why each clause is here rather than "the wrapper is importable":
 *
 *   1. **THE DEFAULT PATH IS THE MECHANICAL ONE, AND THE OLD PATH IS NEVER TAKEN.** The load-bearing
 *      assertion: `createDispatchSinks()` with NO injected `provider` and an EMPTY environment routes a
 *      `prepare-decision` launch to the detached wrapper, and `spawnAgent` — fully wired and fully able to
 *      answer — is not called even once. A test that only asserted the wrapper WAS reached would still pass
 *      if both ran. The bar for this item is "exercised by DEFAULT, not merely present", and this is it.
 *   2. **THE OPT-OUT REALLY RESTORES THE BRIEF.** `WE_PREPARE_DECISION_DISPATCH_MODE=agent` puts the dispatch
 *      back on `claude --bg` with the full prose brief, which is the whole reason
 *      `we:skills-src/conveyor/prepare-decision-agent-brief.md` is kept rather than deleted.
 *   3. **A TYPO THROWS AT SINK CONSTRUCTION.** `mechnical` must never silently pick a side — the failure class
 *      the mode knob exists to remove. It throws BEFORE a single dispatch, naming the var and both values.
 *   4. **RESTART SURVIVAL** — this item's own second acceptance clause. The arc blocks for up to an hour; its
 *      dispatch path is a synchronous `execFileSync` inside the resident runner's own tick. So the spawn must
 *      be DETACHED and unref'd with stdio to a durable file, the sink must return a durable `pid:<n>` handle
 *      in milliseconds, and the liveness read that guards against double-dispatch must answer from the KERNEL
 *      — not from a `claude agents` listing the wrapper was never in, and not from the dispatching process,
 *      which after a restart is gone.
 *
 * NOTHING HERE SPAWNS A PROCESS. Every process boundary — the detached spawn, the pid probe, the agent
 * spawner — is injected, per the same discipline `./dispatch-lane.test.mjs` and
 * `./dispatch-lane-build-wiring.test.mjs` state in theirs. Only the spawn PRIMITIVE is swapped, so what is
 * under test stays the real wiring (sink → registry → this kind's row → its provider) rather than a stand-in
 * that would prove nothing about the default.
 */

import { describe, it, expect } from 'vitest';

import {
  createDispatchObservers,
  createDispatchSinks,
  isDispatchHandleLive,
  routeDispatchProvider,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { detachedHandlePid, deliveryDispatchLogPath } from '../detached-dispatch.mjs';
import {
  DISPATCH_PROVIDER_REGISTRY, dispatchModeFor, dispatchModesFromEnv, dispatchProviderEntry,
} from '../dispatch-provider-registry.mjs';
import {
  PREPARE_DECISION_RUN_SCRIPT, prepareDecisionDetachedProvider,
} from '../dispatch-providers/prepare-decision.mjs';
import { DISPATCH_EFFECT, LIVENESS_SOURCES } from '../dispatch-lane.mjs';
import { parsePrepareDecisionRunArgv, runPrepareDecisionCli } from '../prepare-decision-run.mjs';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step emits for this kind, trimmed to what a provider
 *  reads. `sessionSlug` is `sessionSlugFor`'s own `prepare-decision-<num>` shape. */
const preparePayload = (over = {}) => ({
  num: '2568',
  launchKind: 'prepare-decision',
  lane: 6,
  sessionSlug: 'prepare-decision-2568',
  scope: 'we:backlog/2568-a-decision.md',
  prompt: '# a filled brief\n',
  expectedWithinMinutes: 45,
  ...over,
});

/** A stable, non-lane-shaped root for every `createDispatchSinks` call in this file — see the identical
 *  constant + rationale in `./dispatch-lane-build-wiring.test.mjs` (#3637's 16-test false-failure regression):
 *  `assertNotALaneCheckout` fires on the checkout's own on-disk BASENAME, which these tests never mean to
 *  exercise, so a fixed fake root keeps them hermetic to where they happen to be checked out. */
const PRIMARY = '/primary/webeverything';

/** A `spawnDetached` stub that records the argv + options and answers with a fake child. */
function recordingSpawnDetached(pid = 9310) {
  const calls = [];
  const fn = (argv, opts) => {
    calls.push({ argv, opts });
    return { pid, unref() { calls.at(-1).unrefd = true; } };
  };
  return { fn, calls };
}

/** The REAL `prepare-decision` row with ONLY its process boundary swapped — so what is under test is the
 *  wiring, not a stand-in provider. Everything else in the table stays exactly as it ships. */
function registryWithRecordedSpawn(spawnDetached) {
  return Object.freeze({
    ...DISPATCH_PROVIDER_REGISTRY,
    'prepare-decision': Object.freeze({
      ...DISPATCH_PROVIDER_REGISTRY['prepare-decision'],
      provider: (request) => prepareDecisionDetachedProvider(request, { spawnDetached }),
    }),
  });
}

describe('#3644 — a prepare-decision dispatch is MECHANICAL by default', () => {
  it('a DEFAULT sink with an EMPTY env runs the prepare wrapper and NEVER spawns an agent', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached();

    const sinks = createDispatchSinks({
      root: PRIMARY,
      // NO `provider`, NO `modes` override for this kind beyond what an EMPTY environment resolves to — the
      // sink reads the table itself and installs its own router over it.
      modes: dispatchModesFromEnv({}),
      registry: registryWithRecordedSpawn(spawnDetached),
      // The agent path fully wired and fully able to answer, so a failure here reads "it was not called",
      // never "it could not have been called".
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
    });

    const result = await sinks[DISPATCH_EFFECT](preparePayload());

    expect(detachedCalls).toHaveLength(1);
    expect(detachedCalls[0].argv[0]).toBe(PREPARE_DECISION_RUN_SCRIPT);
    expect(detachedCalls[0].argv).toEqual(expect.arrayContaining([
      '--num=2568', '--lane=6', '--session=prepare-decision-2568', '--scope=we:backlog/2568-a-decision.md',
    ]));
    // THE OLD PATH WAS NEVER TAKEN.
    expect(spawnAgentCalls).toEqual([]);
    // The sink's contract is unchanged: an in-flight marker carrying a durable handle and a deadline.
    expect(result.handle).toBe('pid:9310');
    expect(result.expectedBy).toEqual(expect.any(String));
  });

  it('and the REAL table points at the prepare-decision provider — the half the test above swaps out', () => {
    // Together with the test above this is the whole claim: the sink consults the table, and the table points
    // at this kind's wrapper. Asserting identity here is what lets that test inject a spawn without weakening
    // the claim that the DEFAULT path is the one being exercised.
    expect(DISPATCH_PROVIDER_REGISTRY['prepare-decision'].provider).toBe(prepareDecisionDetachedProvider);
    expect(dispatchProviderEntry('prepare-decision').defaultMode).toBe('mechanical');
    // An unset environment means mechanical. Nothing has to be exported for this to be the live path.
    expect(dispatchModesFromEnv({})['prepare-decision']).toBe('mechanical');
  });

  it('`WE_PREPARE_DECISION_DISPATCH_MODE=agent` restores the prose-brief `claude --bg` spawn, and nothing else does', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached();
    const env = { WE_PREPARE_DECISION_DISPATCH_MODE: 'agent' };

    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes: dispatchModesFromEnv(env),
      registry: registryWithRecordedSpawn(spawnDetached),
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
    });

    const result = await sinks[DISPATCH_EFFECT](preparePayload());

    expect(detachedCalls).toEqual([]);
    expect(spawnAgentCalls).toHaveLength(1);
    // The FULL BRIEF really is the prompt — the thing the opt-out exists to restore, not just "some spawn".
    expect(spawnAgentCalls[0].argv.at(-1)).toBe('# a filled brief\n');
    // #3105 — and the agent is stamped with the LAUNCH kind, the value `guard-bash.mjs` deliberately leaves
    // able to run its own lifecycle (`lane-pool acquire`, `verify-lane request`, `run.mjs open-pr`).
    expect(spawnAgentCalls[0].opts.env.WE_DISPATCH_KIND).toBe('prepare-decision');
    expect(result.handle).toBe('1ae0905c');
  });

  it('opting THIS kind out leaves every other registered kind mechanical, and vice versa', () => {
    const optedOut = dispatchModesFromEnv({ WE_PREPARE_DECISION_DISPATCH_MODE: 'agent' });
    expect(optedOut['prepare-decision']).toBe('agent');
    expect(optedOut.build).toBe('mechanical');
    const buildOptedOut = dispatchModesFromEnv({ WE_BUILD_DISPATCH_MODE: 'agent' });
    expect(buildOptedOut['prepare-decision']).toBe('mechanical');
    expect(buildOptedOut.build).toBe('agent');
  });

  it('a TYPO\'D mode THROWS at sink construction rather than silently picking a path', () => {
    const entry = dispatchProviderEntry('prepare-decision');
    expect(() => dispatchModeFor(entry, { WE_PREPARE_DECISION_DISPATCH_MODE: 'mechnical' })).toThrow(TypeError);
    expect(() => dispatchModeFor(entry, { WE_PREPARE_DECISION_DISPATCH_MODE: 'mechnical' }))
      .toThrow(/WE_PREPARE_DECISION_DISPATCH_MODE must be .*mechanical.*agent/s);
    // The rejected value is named too — a message that hides it sends the operator hunting.
    expect(() => dispatchModeFor(entry, { WE_PREPARE_DECISION_DISPATCH_MODE: 'mechnical' })).toThrow(/mechnical/);

    // AT SINK CONSTRUCTION, which is the clause that matters: the sink refuses to be BUILT rather than
    // building one that quietly routes the wrong way for the rest of the tick.
    expect(() => createDispatchSinks({
      modes: dispatchModesFromEnv({ WE_PREPARE_DECISION_DISPATCH_MODE: 'mechnical' }),
      spawnAgent: () => { throw new Error('nothing may be spawned by a sink that must not exist'); },
    })).toThrow(/WE_PREPARE_DECISION_DISPATCH_MODE/);

    // And the legal values still pass, trimmed and case-insensitive — a stray shell space is not a new failure.
    expect(dispatchModeFor(entry, { WE_PREPARE_DECISION_DISPATCH_MODE: ' AGENT ' })).toBe('agent');
    expect(dispatchModeFor(entry, { WE_PREPARE_DECISION_DISPATCH_MODE: '' })).toBe('mechanical');
  });

  it('refuses a mechanical prepare with no item / lane / session BEFORE any process exists', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    for (const missing of [{ num: null }, { lane: '' }, { sessionSlug: '' }]) {
      expect(() => prepareDecisionDetachedProvider({ ...preparePayload(), ...missing }, { spawnDetached }))
        .toThrow(/refusing a mechanical prepare-decision dispatch/);
    }
    // NOTHING was spawned, so nothing is ambiguous — `notApplied`, the shape that lands the entry `failed`
    // rather than INDETERMINATE.
    expect(calls).toEqual([]);
    try {
      prepareDecisionDetachedProvider({ ...preparePayload(), num: null }, { spawnDetached });
    } catch (e) {
      expect(e.notApplied).toBeTruthy();
    }
  });

  it('recovers the attempt tag from the session slug rather than adding a field to the effect payload', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    prepareDecisionDetachedProvider(preparePayload({ sessionSlug: 'prepare-decision-2568b' }), { spawnDetached });
    expect(calls[0].argv).toContain('--attempt=b');
    const first = recordingSpawnDetached();
    prepareDecisionDetachedProvider(preparePayload(), { spawnDetached: first.fn });
    expect(first.calls[0].argv).toContain('--attempt=');
  });

  it('routes through the registry with NO per-kind knowledge in the router', () => {
    const seen = [];
    const registry = Object.freeze({
      'prepare-decision': {
        kind: 'prepare-decision',
        provider: () => { seen.push('entry'); return 'pid:1'; },
        modeEnv: 'X',
        defaultMode: 'mechanical',
      },
    });
    const agent = () => { seen.push('agent'); return 'abc'; };
    expect(routeDispatchProvider({ launchKind: 'prepare-decision' }, { registry, agent })).toBe('pid:1');
    expect(routeDispatchProvider({ launchKind: 'prepare-decision' }, {
      registry, modes: { 'prepare-decision': 'agent' }, agent,
    })).toBe('abc');
    expect(seen).toEqual(['entry', 'agent']);
  });
});

describe('#3644 — restart survival', () => {
  it('spawns DETACHED, unref\'d, with stdio to a durable log — never a block inside the caller', () => {
    const recorded = [];
    const child = { pid: 777, unref() { recorded.push('unref'); } };
    const handle = prepareDecisionDetachedProvider(preparePayload(), {
      spawnDetached: (argv, opts) => { recorded.push(opts); return child; },
    });
    expect(handle).toBe('pid:777');
    expect(recorded[0].logPath).toBe(deliveryDispatchLogPath('prepare-decision-2568'));
  });

  it('the DEFAULT detached spawner really passes `detached: true` and file-backed stdio for THIS kind too', async () => {
    // Exercised through the real provider's own default, so the options asserted are the ones this kind
    // actually ships with — `detached: true` is what makes the child a new session LEADER, outside the
    // runner's process group, so the group signal `restart-runner` sends never reaches it.
    const { defaultSpawnDetached } = await import('../detached-dispatch.mjs');
    let opts = null;
    let unrefd = false;
    const child = defaultSpawnDetached([PREPARE_DECISION_RUN_SCRIPT], { cwd: '/repo', logPath: '/tmp/x/y.log' }, {
      spawn: (bin, argv, o) => { opts = { bin, argv, o }; return { pid: 5, unref() { unrefd = true; } }; },
      ensureDir: () => {},
      openLog: () => 99,
    });
    expect(child.pid).toBe(5);
    expect(opts.o.detached).toBe(true);
    expect(opts.o.stdio).toEqual(['ignore', 99, 99]);
    // `.unref()` is what lets the DISPATCHING process exit without waiting on the hour-long child — the other
    // half of "the block never sits inside the runner's tick".
    expect(unrefd).toBe(true);
  });

  it('the handle is `pid:<n>` and the KERNEL answers its liveness — not a `claude agents` listing', () => {
    const { fn: spawnDetached } = recordingSpawnDetached(4242);
    const handle = prepareDecisionDetachedProvider(preparePayload(), { spawnDetached });
    expect(handle).toBe('pid:4242');
    expect(detachedHandlePid(handle)).toBe(4242);

    // A running prepare reads LIVE even though `claude agents` has never heard of it — the whole point.
    expect(isDispatchHandleLive(handle, [], { isPidAlive: (p) => p === 4242 })).toBe(true);
    expect(isDispatchHandleLive(handle, [{ sessionId: 'pid:4242' }], { isPidAlive: () => false })).toBe(false);
  });

  it('a RESTARTED runner still reads the in-flight prepare as LIVE — the double-dispatch guard holds', () => {
    // THE ACCEPTANCE CLAUSE, asserted through the path the guard itself uses. `stampLiveness` is handed a run
    // record as a restarted process would read it back off disk — it never parented this pid, and there is no
    // `claude agents` listing to consult. The listing reader is wired to THROW, so a liveness answer that
    // depended on it could not come back at all.
    const stamped = stampLiveness(
      {
        runs: [{
          runId: 'r-prepare', handle: 'pid:4242', startedAt: '2026-09-12T10:00:00Z',
          payload: { num: '2568', launchKind: 'prepare-decision', sessionSlug: 'prepare-decision-2568' },
        }],
        unreadable: 0,
      },
      {
        listAgents: () => { throw new Error('`claude agents` must not be shelled for an all-pid in-flight set'); },
        isPidAlive: () => true,
      },
    );
    expect(stamped.runs[0].live).toBe(true);
    expect(stamped.livenessSource).toBe('wrapper-pid');
    expect(LIVENESS_SOURCES).toContain('wrapper-pid');

    // …and a prepare whose process is genuinely GONE reads dead, so the guard releases rather than holding an
    // item forever. Both directions, or "live" would be a constant.
    const dead = stampLiveness(
      { runs: [{ runId: 'r-prepare', handle: 'pid:4242' }], unreadable: 0 },
      { listAgents: () => { throw new Error('not consulted'); }, isPidAlive: () => false },
    );
    expect(dead.runs[0].live).toBe(false);
  });

  it('the observer reports a live detached prepare as `running` without shelling `claude`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => true,
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: new Date().toISOString(),
      payload: { num: '2568', sessionSlug: 'prepare-decision-2568' },
    };
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' }))
      .resolves.toEqual({ status: 'running', result: null });
  });

  it('an EXITED detached prepare past the grace is `unresolved`, naming its log — never `succeeded`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => false,
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: '2026-09-12T10:00:00Z',
      payload: { num: '2568', sessionSlug: 'prepare-decision-2568' },
    };
    const out = await observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' });
    expect(out.status).toBe('unresolved');
    expect(out.error).toContain(deliveryDispatchLogPath('prepare-decision-2568'));
  });

  it('a pid node could not report is INDETERMINATE — it throws rather than inventing a handle', () => {
    expect(() => prepareDecisionDetachedProvider(preparePayload(), { spawnDetached: () => ({ pid: 0 }) }))
      .toThrow(/cannot be told from here/);
    expect(() => prepareDecisionDetachedProvider(preparePayload(), { spawnDetached: () => ({}) }))
      .toThrow(/cannot be told from here/);
  });
});

describe('#3644 — the per-dispatch process', () => {
  it('parses the launch the provider hands it, and refuses a missing one BY NAME', () => {
    expect(parsePrepareDecisionRunArgv([
      '--num=2568', '--lane=6', '--session=prepare-decision-2568', '--scope=we:backlog/2568-x.md', '--attempt=b',
    ])).toEqual({
      item: '2568', lane: '6', scope: 'we:backlog/2568-x.md', sessionSlug: 'prepare-decision-2568', attemptTag: 'b',
    });
    // `scope` and `attempt` are genuinely optional — a first attempt has no tag.
    expect(parsePrepareDecisionRunArgv(['--num=2568', '--lane=6', '--session=s']))
      .toEqual({ item: '2568', lane: '6', scope: '', sessionSlug: 's', attemptTag: '' });
    expect(() => parsePrepareDecisionRunArgv(['--num=2568'])).toThrow(/--lane=.*--session=/s);
    expect(() => parsePrepareDecisionRunArgv([])).toThrow(TypeError);
  });

  it('the argv the PROVIDER builds is exactly the one the RUN SCRIPT parses — no field invented at the seam', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    prepareDecisionDetachedProvider(preparePayload({ sessionSlug: 'prepare-decision-2568b' }), { spawnDetached });
    // Drop argv[0] (the script path) and parse what is left with the run script's own parser.
    expect(parsePrepareDecisionRunArgv(calls[0].argv.slice(1))).toEqual({
      item: '2568', lane: '6', scope: 'we:backlog/2568-a-decision.md',
      sessionSlug: 'prepare-decision-2568b', attemptTag: 'b',
    });
  });

  it('exits 0 on every outcome the wrapper REASONS about, and 1 only when it throws', async () => {
    const argv = ['--num=2568', '--lane=6', '--session=prepare-decision-2568'];
    const out = [];
    for (const result of ['could-not-prepare (the card names no concrete choice)', 'gate-red', 'gate-blocked (stale marker)', 'PR #2140 (ready-to-merge)']) {
      const r = await runPrepareDecisionCli(argv, {
        prepare: async () => ({ item: '2568', result }),
        write: (l) => out.push(l),
        writeErr: (l) => out.push(l),
      });
      expect(r.code).toBe(0);
      expect(r.result.result).toBe(result);
    }
    expect(out.join('')).toContain('PR #2140');

    const thrown = await runPrepareDecisionCli(argv, {
      prepare: async () => { throw new Error('lane-pool acquire refused'); },
      write: () => {}, writeErr: () => {},
    });
    expect(thrown).toEqual({ code: 1, result: null });

    // A bad argv fails before anything is started, and says which flag.
    const badArgv = await runPrepareDecisionCli(['--num=2568'], {
      prepare: () => { throw new Error('must never be reached'); },
      write: () => {}, writeErr: () => {},
    });
    expect(badArgv).toEqual({ code: 1, result: null });
  });
});
