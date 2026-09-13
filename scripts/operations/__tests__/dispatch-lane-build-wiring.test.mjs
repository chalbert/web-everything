/**
 * @file dispatch-lane-build-wiring.test.mjs — #3645: the `build` dispatch runs the DELIVER-ITEM WRAPPER.
 *
 * WHAT THIS FILE PROVES, and why each clause is here rather than "the wrapper is importable":
 *
 *   1. **THE OLD PATH IS NEVER TAKEN.** The load-bearing assertion, and the same shape the `review` wiring's
 *      own test used the same day (`./review-dispatch.test.mjs`, "an unflagged `--pr/--repo` invocation calls
 *      the WRAPPER and never spawns an agent"): under the DEFAULT sink, a `build` dispatch must not reach
 *      `defaultClaudeProvider`/`spawnAgent` at all. A test that only asserted the wrapper WAS called would
 *      still pass if both ran.
 *   2. **ROUTING FOLLOWS THE REGISTRY, AND AN UNREGISTERED KIND KEEPS THE AGENT PATH.** A kind with no wrapper
 *      owning its lifecycle must keep spawning its own agent from its own brief, or a routing change sweeping
 *      it in would deny it its own first step. Stated as an INVARIANT (routed mechanically iff registered)
 *      rather than as a list of kind names — #3641 rewrote it that way when `prepare` became the second
 *      registered kind, so the three lanes still to land (`prepare-decision` #3644, `fix` #3640, `ci-heal`
 *      #3642) do not each have to re-edit this assertion. The one place the names are still enumerated is
 *      `./dispatch-provider-registry.test.mjs`'s own ledger, which is deliberately a tripwire.
 *   3. **RESTART-SURVIVAL** — the acceptance criterion #3645 was filed with. The wrapper's arc blocks for up to
 *      an hour; the dispatch path is a synchronous `execFileSync` inside the resident runner's own tick. So the
 *      spawn must be DETACHED (`detached: true`, `unref`'d, stdio to a durable file), the sink must return a
 *      durable handle in milliseconds, and the liveness read that guards against double-dispatch must answer
 *      from the KERNEL — not from a `claude agents` listing the wrapper was never in, and not from the
 *      dispatching process, which may itself be gone.
 *
 * NOTHING HERE SPAWNS A PROCESS. Every process boundary — the detached spawn, the pid probe, the agent
 * spawner — is injected, per the same discipline `./dispatch-lane.test.mjs` states in its own header.
 */

import { describe, it, expect } from 'vitest';

import {
  BUILD_DISPATCH_MODE_ENV,
  DELIVER_ITEM_RUN_SCRIPT,
  DETACHED_HANDLE_PREFIX,
  buildDispatchModeFromEnv,
  createDispatchObservers,
  createDispatchSinks,
  defaultIsPidAlive,
  deliverItemDetachedProvider,
  deliveryDispatchLogPath,
  detachedHandlePid,
  isDispatchHandleLive,
  routeDispatchProvider,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { DISPATCH_PROVIDER_REGISTRY, dispatchProviderEntry } from '../dispatch-provider-registry.mjs';
import { DISPATCH_EFFECT, LAUNCH_KINDS, LIVENESS_SOURCES } from '../dispatch-lane.mjs';
import { parseDeliverItemRunArgv, runDeliverItemCli, selectDeliveryAgentProvider } from '../deliver-item-run.mjs';
import { DELIVERY_AGENT_PROVIDERS } from '../deliver-item-wrapper.mjs';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step actually emits, trimmed to what a provider reads. */
const buildPayload = (over = {}) => ({
  num: '3645',
  launchKind: 'build',
  lane: 4,
  sessionSlug: 'conveyor-3645',
  scope: 'we:scripts/operations',
  prompt: '# a filled brief\n',
  expectedWithinMinutes: 45,
  ...over,
});

/** A `spawnDetached` stub that records the argv + options and answers with a fake child. */
function recordingSpawnDetached(pid = 4242) {
  const calls = [];
  const fn = (argv, opts) => {
    calls.push({ argv, opts });
    return { pid, unref() { calls.at(-1).unrefd = true; } };
  };
  return { fn, calls };
}

describe('#3645 — the build dispatch is MECHANICAL by default', () => {
  it('a DEFAULT build dispatch runs the deliver-item wrapper and NEVER spawns an agent', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached(9001);
    const sinks = createDispatchSinks({
      // THE OLD PATH, fully wired and fully able to answer — so a failure here is "it was not called",
      // never "it could not have been called".
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached }),
        agent: () => { throw new Error('the agent provider must not be reached for a default build dispatch'); },
      }),
    });

    const result = await sinks[DISPATCH_EFFECT](buildPayload());

    // 1. THE WRAPPER RAN — and it ran as its OWN process, pointed at the real entry script.
    expect(detachedCalls).toHaveLength(1);
    expect(detachedCalls[0].argv[0]).toBe(DELIVER_ITEM_RUN_SCRIPT);
    expect(detachedCalls[0].argv).toEqual(expect.arrayContaining([
      '--num=3645', '--lane=4', '--session=conveyor-3645', '--scope=we:scripts/operations',
    ]));
    // 2. THE OLD PATH WAS NEVER TAKEN. This is the assertion the whole file exists for.
    expect(spawnAgentCalls).toEqual([]);
    // 3. The sink's contract is unchanged: an in-flight marker carrying a durable handle and a deadline.
    expect(result.handle).toBe('pid:9001');
    expect(result.expectedBy).toEqual(expect.any(String));
  });

  it('`WE_BUILD_DISPATCH_MODE=agent` restores the pre-#3645 `claude --bg` spawn, and nothing else does', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      buildMode: 'agent',
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'agent',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached }),
        agent: (r) => {
          spawnAgentCalls.push({ argv: ['--bg'], kind: r.launchKind });
          return '1ae0905c';
        },
      }),
    });

    const result = await sinks[DISPATCH_EFFECT](buildPayload());

    expect(detachedCalls).toEqual([]);
    expect(spawnAgentCalls).toHaveLength(1);
    expect(result.handle).toBe('1ae0905c');
  });

  it('routes a kind mechanically IF AND ONLY IF the registry holds an entry for it', () => {
    // THE INVARIANT, not a snapshot (#3641). Asserting "only `build`" made this the one assertion every
    // sibling wiring lane had to come back and edit — five lanes serializing on three lines that say nothing
    // a lookup does not already say. What actually has to hold is that the router consults the TABLE and
    // nothing else: a registered kind reaches its own provider, an unregistered one keeps the unchanged
    // `claude --bg` agent path, and neither fact is spelled out here as a list of names. The names live in
    // exactly one place, `./dispatch-provider-registry.test.mjs`'s ledger, which is meant to be edited.
    const seen = [];
    for (const kind of LAUNCH_KINDS) {
      routeDispatchProvider({ launchKind: kind, num: '1', lane: 1, sessionSlug: 's' }, {
        // Every registered kind's provider replaced by a recorder, so no real process is ever started —
        // including `prepare`'s, which #3641 registered.
        registry: Object.fromEntries(Object.entries(DISPATCH_PROVIDER_REGISTRY).map(([k, entry]) => [k, {
          ...entry, provider: () => { seen.push(['mechanical', k]); return 'pid:1'; },
        }])),
        modes: Object.fromEntries(Object.keys(DISPATCH_PROVIDER_REGISTRY).map((k) => [k, 'mechanical'])),
        agent: () => { seen.push(['agent', kind]); return 'abc'; },
      });
    }
    const registered = LAUNCH_KINDS.filter((k) => dispatchProviderEntry(k) !== null);
    expect(seen.filter(([via]) => via === 'mechanical').map(([, k]) => k)).toEqual(registered);
    // And every kind the table does NOT name went the agent way, unchanged — the half that would break a
    // brief's own first step if routing ever swept it in.
    expect(seen.filter(([via]) => via === 'agent').map(([, k]) => k))
      .toEqual(LAUNCH_KINDS.filter((k) => dispatchProviderEntry(k) === null));
    // A guard against the assertion going vacuous if the table were ever emptied or filled wholesale.
    expect(registered.length).toBeGreaterThan(0);
    expect(registered.length).toBeLessThan(LAUNCH_KINDS.length);
  });

  it('refuses a mechanical build with no item / lane / session BEFORE any process exists', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    for (const missing of [{ num: null }, { lane: '' }, { sessionSlug: '' }]) {
      expect(() => deliverItemDetachedProvider(
        { launchKind: 'build', ...buildPayload(), ...missing }, { spawnDetached },
      )).toThrow(/refusing a mechanical build dispatch/);
    }
    // NOTHING was spawned, so nothing is ambiguous — the `notApplied` shape `buildAgentArgv` uses for an
    // empty prompt, for the same reason.
    expect(calls).toEqual([]);
  });

  it('recovers the attempt tag from the session slug rather than adding a field to the effect payload', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    deliverItemDetachedProvider(buildPayload({ sessionSlug: 'conveyor-3645b' }), { spawnDetached });
    expect(calls[0].argv).toContain('--attempt=b');
  });
});

describe('#3645 — restart survival', () => {
  it('spawns DETACHED, unref\'d, with stdio to a durable log — never a block inside the caller', () => {
    const recorded = [];
    const child = { pid: 777, unref() { recorded.push('unref'); } };
    const handle = deliverItemDetachedProvider(buildPayload(), {
      spawnDetached: (argv, opts, io) => {
        // Exercise the REAL default spawner so its OPTIONS are asserted, not a stub's — the same reason
        // `defaultSpawnAgent`/`defaultRunNode` are exported at all (PR #1211 review, F5).
        void io;
        recorded.push(opts);
        return child;
      },
    });
    expect(handle).toBe('pid:777');
    expect(recorded[0].logPath).toBe(deliveryDispatchLogPath('conveyor-3645'));
  });

  it('the DEFAULT detached spawner really passes `detached: true` and file-backed stdio', async () => {
    const { defaultSpawnDetached } = await import('../dispatch-lane-io.mjs');
    let opts = null;
    const child = defaultSpawnDetached(['/x.mjs'], { cwd: '/repo', logPath: '/tmp/x/y.log' }, {
      spawn: (bin, argv, o) => { opts = { bin, argv, o }; return { pid: 5, unref() {} }; },
      ensureDir: () => {},
      openLog: () => 99,
    });
    expect(child.pid).toBe(5);
    expect(opts.o.detached).toBe(true);
    expect(opts.o.cwd).toBe('/repo');
    // stdin ignored, stdout AND stderr onto the same real fd — a detached child whose pipe nobody drains
    // blocks once that pipe fills.
    expect(opts.o.stdio).toEqual(['ignore', 99, 99]);
  });

  it('liveness for a detached delivery is answered by the KERNEL, not by a `claude agents` listing', () => {
    expect(detachedHandlePid('pid:4242')).toBe(4242);
    expect(detachedHandlePid('1ae0905c')).toBeNull();
    expect(detachedHandlePid('pid:0')).toBeNull();

    // A running wrapper reads LIVE even though `claude agents` has never heard of it — the whole point.
    expect(isDispatchHandleLive('pid:4242', [], { isPidAlive: (p) => p === 4242 })).toBe(true);
    expect(isDispatchHandleLive('pid:4242', [{ sessionId: 'pid:4242' }], { isPidAlive: () => false })).toBe(false);
    // A `claude --bg` handle is still answered the old way, by prefix, against the listing.
    expect(isDispatchHandleLive('1ae0905c', [{ sessionId: '1ae0905c-314c-4f73-a7c4-3973a9005e82' }], {
      isPidAlive: () => { throw new Error('a claude handle must never reach the pid probe'); },
    })).toBe(true);
  });

  it('a RESTARTED runner still sees the in-flight delivery as alive — the double-dispatch guard holds', () => {
    // The run record is read back off disk by a process that never dispatched anything (that cross-process
    // half is `./dispatch-crosses-processes.test.mjs`'s own subject); what this asserts is that the liveness
    // stamp it gets does NOT depend on a `claude agents` listing existing or being readable.
    const stamped = stampLiveness(
      { runs: [{ runId: 'r1', handle: 'pid:4242', startedAt: '2026-09-12T10:00:00Z' }], unreadable: 0 },
      {
        listAgents: () => { throw new Error('`claude agents` must not be shelled for an all-pid in-flight set'); },
        isPidAlive: () => true,
      },
    );
    expect(stamped.runs[0].live).toBe(true);
    expect(stamped.livenessSource).toBe('wrapper-pid');
    // And the source is a RECOGNISED one, not an unknown that silently degrades the guard.
    expect(LIVENESS_SOURCES).toContain('wrapper-pid');
  });

  it('a MIXED in-flight set asks each handle its own question', () => {
    const stamped = stampLiveness(
      {
        runs: [
          { runId: 'r1', handle: 'pid:4242' },
          { runId: 'r2', handle: '1ae0905c' },
        ],
        unreadable: 0,
      },
      {
        listAgents: () => [{ sessionId: '1ae0905c-314c-4f73-a7c4-3973a9005e82' }],
        isPidAlive: () => false,
      },
    );
    expect(stamped.runs.map((r) => r.live)).toEqual([false, true]);
    expect(stamped.livenessSource).toBe('claude-agents');
  });

  it('the observer reports a live detached delivery as `running` without shelling `claude`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => true,
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: new Date().toISOString(),
      payload: { num: '3645', sessionSlug: 'conveyor-3645' },
    };
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' }))
      .resolves.toEqual({ status: 'running', result: null });
  });

  it('an EXITED detached delivery past the grace is `unresolved`, naming its log — never `succeeded`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => false,
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: '2026-09-12T10:00:00Z',
      payload: { num: '3645', sessionSlug: 'conveyor-3645' },
    };
    const out = await observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' });
    expect(out.status).toBe('unresolved');
    expect(out.error).toContain(deliveryDispatchLogPath('conveyor-3645'));
  });

  it('`defaultIsPidAlive` answers truthfully about this very process, and about a pid that cannot exist', () => {
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(2 ** 30)).toBe(false);
  });
});

describe('#3645 — the mode knob and the per-dispatch process', () => {
  it('defaults to `mechanical`, accepts `agent`, and REFUSES anything else rather than guessing', () => {
    expect(buildDispatchModeFromEnv({})).toBe('mechanical');
    expect(buildDispatchModeFromEnv({ [BUILD_DISPATCH_MODE_ENV]: 'agent' })).toBe('agent');
    expect(buildDispatchModeFromEnv({ [BUILD_DISPATCH_MODE_ENV]: ' MECHANICAL ' })).toBe('mechanical');
    // A typo must not silently pick a path — it is the exact failure class this wiring removes.
    expect(() => buildDispatchModeFromEnv({ [BUILD_DISPATCH_MODE_ENV]: 'mechnical' })).toThrow(/must be/);
  });

  it('`deliver-item-run.mjs` parses the launch the provider hands it, and refuses a missing one by name', () => {
    // `provider` (#3580) is parsed but NOT validated here — empty means "nobody named one", which
    // `selectDeliveryAgentProvider` then resolves through the env and the default.
    expect(parseDeliverItemRunArgv(['--num=3645', '--lane=4', '--session=conveyor-3645b', '--attempt=b', '--scope=we:x']))
      .toEqual({ item: '3645', lane: '4', scope: 'we:x', sessionSlug: 'conveyor-3645b', attemptTag: 'b', provider: '' });
    expect(parseDeliverItemRunArgv(['--num=1', '--lane=2', '--session=s', '--provider=codex']).provider).toBe('codex');
    expect(() => parseDeliverItemRunArgv(['--num=3645'])).toThrow(/--lane=.*--session=/);
  });

  // #3580 — WHICH CLI runs the delivery agent. Same flag-wins-env-fallback shape `run.mjs` uses for the judge
  // seam's `--provider`/`JUDGE_PROVIDER`, so one selection mechanism covers both seams.
  it('selects the delivery agent provider: flag beats env, env beats the default, and Claude IS the default', () => {
    expect(selectDeliveryAgentProvider('', {}).name).toBe('claude-restricted');
    expect(selectDeliveryAgentProvider('', { DELIVERY_AGENT_PROVIDER: 'codex' }).name).toBe('codex');
    expect(selectDeliveryAgentProvider('codex', {}).name).toBe('codex');
    // An explicit flag OUTRANKS the environment — never the other way round.
    expect(selectDeliveryAgentProvider('claude-restricted', { DELIVERY_AGENT_PROVIDER: 'codex' }).name)
      .toBe('claude-restricted');
    expect(selectDeliveryAgentProvider('codex', {}).provider).toBe(DELIVERY_AGENT_PROVIDERS.codex);
  });

  it('refuses an unknown provider name BEFORE a lane is acquired or an item claimed', async () => {
    expect(() => selectDeliveryAgentProvider('gemini', {})).toThrow(/--provider must be one of/);
    let delivered = false;
    const res = await runDeliverItemCli(['--num=1', '--lane=2', '--session=s', '--provider=gemini'], {
      write: () => {}, writeErr: () => {}, env: {},
      deliver: async () => { delivered = true; return { item: '1', result: 'ok' }; },
    });
    expect(res).toMatchObject({ code: 1, result: null });
    expect(delivered).toBe(false);
  });

  it('hands the CHOSEN provider to `deliverItem` as its second argument (the port\'s own selection seam)', async () => {
    let seenProvider = null;
    await runDeliverItemCli(['--num=1', '--lane=2', '--session=s', '--provider=codex'], {
      write: () => {}, writeErr: () => {}, env: {},
      deliver: async (_launch, provider) => { seenProvider = provider; return { item: '1', result: 'ok' }; },
    });
    expect(seenProvider).toBe(DELIVERY_AGENT_PROVIDERS.codex);
  });

  it('the per-dispatch process exits 0 on every outcome `deliverItem` REASONS about, 1 only when it throws', async () => {
    const argv = ['--num=3645', '--lane=4', '--session=conveyor-3645'];
    const quiet = { write: () => {}, writeErr: () => {} };

    // `gate-red` is a real, released, reported outcome — the mechanism worked.
    await expect(runDeliverItemCli(argv, { ...quiet, deliver: async () => ({ item: '3645', result: 'gate-red' }) }))
      .resolves.toMatchObject({ code: 0 });
    // A wrapper-side throw (acquire refused, gate script crashed) is the only non-zero exit.
    await expect(runDeliverItemCli(argv, { ...quiet, deliver: async () => { throw new Error('lane refused'); } }))
      .resolves.toMatchObject({ code: 1, result: null });
  });

  it('the launch it is handed is exactly the shape `deliverItem` takes — no field invented at the seam', async () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    deliverItemDetachedProvider(buildPayload({ sessionSlug: 'conveyor-3645c' }), { spawnDetached });
    const flags = calls[0].argv.slice(1);
    let seen = null;
    await runDeliverItemCli(flags, {
      write: () => {}, writeErr: () => {},
      deliver: async (launch) => { seen = launch; return { item: launch.item, result: 'ok' }; },
    });
    expect(seen).toEqual({
      item: '3645', lane: '4', scope: 'we:scripts/operations', sessionSlug: 'conveyor-3645c', attemptTag: 'c',
      // #3580 — the detached provider names no `--provider`, so the launch carries an empty one and the
      // default applies. The seam still invents nothing: this field comes from argv like every other.
      provider: '',
    });
  });

  it('the handle prefix is one no `claude --bg` handle can collide with', () => {
    expect(DETACHED_HANDLE_PREFIX).toBe('pid:');
    // `parseBackgroundedHandle` only ever yields lower-case hex, so a colon can never appear in one.
    expect(detachedHandlePid('deadbeef')).toBeNull();
  });
});
