/**
 * @file dispatch-lane-ci-heal-wiring.test.mjs — THE `ci-heal` DISPATCH IS MECHANICAL BY DEFAULT (#3642).
 *
 * The sibling of `./dispatch-lane-fix-wiring.test.mjs`, and deliberately the same shape. What it proves, and
 * why each clause is here rather than "the wrapper is importable":
 *
 *   1. **THE DEFAULT PATH IS THE MECHANICAL ONE.** A `ci-heal` launch through `createDispatchSinks` with NO
 *      injected provider and an EMPTY environment reaches `ciHealDetachedProvider` and NEVER `spawnAgent`. A
 *      registry row that were correct but unconsulted would pass every other test in this file.
 *   2. **THE OLD PATH IS STILL REACHABLE, AND ONLY DELIBERATELY.** `WE_CI_HEAL_DISPATCH_MODE=agent` restores
 *      the full-brief `claude --bg` spawn; a TYPO throws at sink construction rather than picking a side.
 *   3. **RESTART SURVIVAL.** The handle is `pid:<n>`, its liveness is a kernel probe, and it is proven through
 *      the REAL `stampLiveness` with the `claude agents` listing reader wired to THROW — so a pid handle
 *      provably never shells it, and a restarted runner's double-dispatch guard holds. This is the parent
 *      epic's cross-cutting clause and this item's "Done when" 2.
 *   4. **PR-KEYED, AND `reason`-CARRYING.** `ci-heal` is the only kind whose brief requires a `REASON`, so the
 *      sink→port→provider→argv path for it is asserted end to end. The two independent derivations of the
 *      session slug are asserted to agree, and the argv is asserted NOT to carry build's item-keyed fields.
 *   5. **`ci-heal-run.mjs`'s OWN ARC** — argv, repo-slug resolution, exit-code rule. (The WRAPPER's arc is
 *      `./ci-heal-dispatch-wrapper.test.mjs`'s subject.)
 *
 * NOTHING HERE SPAWNS A PROCESS, shells `gh`, or starts a runner. Every process boundary is injected.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createDispatchSinks,
  defaultIsPidAlive,
  defaultSpawnDetached,
  deliveryDispatchLogPath,
  detachedHandlePid,
  isDispatchHandleLive,
  routeDispatchProvider,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT, LIVENESS_SOURCES, sessionSlugFor } from '../dispatch-lane.mjs';
import {
  DISPATCH_PROVIDER_REGISTRY,
  dispatchModesFromEnv,
} from '../dispatch-provider-registry.mjs';
import { CI_HEAL_RUN_SCRIPT, ciHealDetachedProvider } from '../dispatch-providers/ci-heal.mjs';
import {
  assertSessionSlugAgrees,
  parseCiHealRunArgv,
  resolveRepoSlug,
  runCiHealCli,
  selectCiHealAgentProvider,
} from '../ci-heal-run.mjs';
import { planCiHealDispatchWrapper, CI_HEAL_AGENT_PROVIDERS } from '../ci-heal-dispatch-wrapper.mjs';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step emits for a `ci-heal` launch, trimmed to what a
 *  provider reads. `pr`/`reason` have ridden the payload since #3332 and the port since #3640. */
const ciHealPayload = (over = {}) => ({
  num: '2638',
  launchKind: 'ci-heal',
  lane: 5,
  pr: 743,
  reason: 'red-ci',
  sessionSlug: 'ci-heal-743',
  scope: 'we:scripts/operations',
  prompt: '# a filled ci-heal brief\n',
  expectedWithinMinutes: 45,
  ...over,
});

/** A stable, non-lane-shaped root for every `createDispatchSinks` call in this file — see the identical
 *  constant + rationale in `./dispatch-lane-build-wiring.test.mjs` (#3637's 16-test false-failure regression):
 *  `assertNotALaneCheckout` fires on the checkout's own on-disk BASENAME, which these tests never mean to
 *  exercise, so a fixed fake root keeps them hermetic to where they happen to be checked out. */
const PRIMARY = '/primary/webeverything';

/** A `spawnDetached` stub that records the argv + options and answers with a fake child. */
function recordingSpawnDetached(pid = 4343) {
  const calls = [];
  const fn = (argv, opts) => {
    calls.push({ argv, opts });
    return { pid, unref() { calls.at(-1).unrefd = true; } };
  };
  return { fn, calls };
}

/** The REAL `ci-heal` entry, with ONLY its process boundary swapped — so what is under test is the wiring
 *  (sink → registry → entry.provider), never a stand-in provider that would prove nothing about the default. */
function registryWithSpawn(spawnDetached) {
  return Object.freeze({
    ...DISPATCH_PROVIDER_REGISTRY,
    'ci-heal': Object.freeze({
      ...DISPATCH_PROVIDER_REGISTRY['ci-heal'],
      provider: (request) => ciHealDetachedProvider(request, { spawnDetached }),
    }),
  });
}

describe('#3642 — the ci-heal dispatch is MECHANICAL by default', () => {
  it('a DEFAULT ci-heal dispatch with an EMPTY env runs the ci-heal wrapper and NEVER spawns an agent', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached(9102);
    const sinks = createDispatchSinks({
      root: PRIMARY,
      // NO `provider`, NO per-kind scalar: the sink resolves the mode itself from an environment with nothing
      // in it and installs its own router over the table.
      modes: dispatchModesFromEnv({}),
      registry: registryWithSpawn(spawnDetached),
      // THE OLD PATH, fully wired and fully able to answer — so a failure here is "it was not called", never
      // "it could not have been called".
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
    });

    const result = await sinks[DISPATCH_EFFECT](ciHealPayload());

    // 1. THE WRAPPER RAN, as its OWN process, pointed at the real entry script.
    expect(detachedCalls).toHaveLength(1);
    expect(detachedCalls[0].argv[0]).toBe(CI_HEAL_RUN_SCRIPT);
    expect(detachedCalls[0].argv).toEqual(expect.arrayContaining([
      '--pr=743', '--session=ci-heal-743', '--num=2638', '--reason=red-ci',
    ]));
    // 2. THE OLD PATH WAS NEVER TAKEN. This is the assertion the whole file exists for.
    expect(spawnAgentCalls).toEqual([]);
    // 3. The sink's contract is unchanged: an in-flight marker carrying a durable handle and a deadline.
    expect(result.handle).toBe('pid:9102');
    expect(result.expectedBy).toEqual(expect.any(String));
  });

  it('and the REAL table\'s `ci-heal` provider IS the ci-heal wrapper\'s — the half the test above swaps out', () => {
    expect(DISPATCH_PROVIDER_REGISTRY['ci-heal'].provider).toBe(ciHealDetachedProvider);
    expect(DISPATCH_PROVIDER_REGISTRY['ci-heal'].modeEnv).toBe('WE_CI_HEAL_DISPATCH_MODE');
    expect(DISPATCH_PROVIDER_REGISTRY['ci-heal'].defaultMode).toBe('mechanical');
  });

  it('`WE_CI_HEAL_DISPATCH_MODE=agent` restores the full-brief `claude --bg` spawn, and nothing else does', async () => {
    const spawnAgentCalls = [];
    const { fn: spawnDetached, calls: detachedCalls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes: dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: 'agent' }),
      registry: registryWithSpawn(spawnDetached),
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
    });

    const result = await sinks[DISPATCH_EFFECT](ciHealPayload());

    expect(detachedCalls).toEqual([]);
    expect(spawnAgentCalls).toHaveLength(1);
    // The old path's own contract, unchanged: the filled brief is the prompt, and the stamp is the LAUNCH kind
    // (NOT the wrapper-agent kind `repair` — that agent runs its own lifecycle out of the full brief).
    expect(spawnAgentCalls[0].argv).toContain('# a filled ci-heal brief\n');
    expect(spawnAgentCalls[0].opts.env.WE_DISPATCH_KIND).toBe('ci-heal');
    expect(result.handle).toBe('1ae0905c');
  });

  it('opting `ci-heal` out does NOT opt any sibling kind out — the modes are per kind', async () => {
    const modes = dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: 'agent' });
    // Derived from the table, never a name list — #3641's own lesson.
    const defaults = Object.fromEntries(
      Object.entries(DISPATCH_PROVIDER_REGISTRY).map(([k, e]) => [k, e.defaultMode]),
    );
    expect(modes).toEqual({ ...defaults, 'ci-heal': 'agent' });
    for (const [kind, mode] of Object.entries(modes)) {
      if (kind !== 'ci-heal') expect(mode, kind).toBe(defaults[kind]);
    }
    // …and the sibling repair kind in particular still routes mechanically under that same env.
    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes,
      registry: Object.freeze({
        ...DISPATCH_PROVIDER_REGISTRY,
        fix: Object.freeze({ ...DISPATCH_PROVIDER_REGISTRY.fix, provider: () => 'pid:9103' }),
      }),
      spawnAgent: () => { throw new Error('a default `fix` dispatch must not reach the agent path'); },
    });
    const result = await sinks[DISPATCH_EFFECT]({ ...ciHealPayload(), launchKind: 'fix', sessionSlug: 'fix-743' });
    expect(result.handle).toBe('pid:9103');
  });

  it('a TYPO\'D mode THROWS at sink construction, before a single dispatch', () => {
    expect(() => createDispatchSinks({ modes: dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: 'mechnical' }) }))
      .toThrow(/WE_CI_HEAL_DISPATCH_MODE must be .*mechanical.*agent/s);
    expect(() => createDispatchSinks({ modes: dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: 'mechnical' }) }))
      .toThrow(/mechnical/);
    // ` AGENT ` is accepted — a shell that exports with a stray space is not a fresh failure mode.
    expect(dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: ' AGENT ' })['ci-heal']).toBe('agent');
  });

  it('routing a `ci-heal` request through the router reaches the entry, not the agent', () => {
    const seen = [];
    routeDispatchProvider(ciHealPayload(), {
      registry: Object.freeze({
        ...DISPATCH_PROVIDER_REGISTRY,
        'ci-heal': Object.freeze({
          ...DISPATCH_PROVIDER_REGISTRY['ci-heal'],
          provider: () => { seen.push('entry'); return 'pid:1'; },
        }),
      }),
      agent: () => { seen.push('agent'); return 'abc'; },
    });
    expect(seen).toEqual(['entry']);
  });
});

describe('#3642 — the provider refuses rather than guesses', () => {
  it('refuses a mechanical ci-heal dispatch with no PR or no session slug, BEFORE any process exists', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    for (const [missing, why] of [[{ pr: null }, /with no PR number/], [{ sessionSlug: '' }, /with no session slug/]]) {
      let thrown;
      try { ciHealDetachedProvider({ ...ciHealPayload(), ...missing }, { spawnDetached }); } catch (e) { thrown = e; }
      expect(thrown, JSON.stringify(missing)).toBeDefined();
      expect(thrown.message).toMatch(why);
      // `notApplied`, so the entry lands `failed` and is retried — nothing started, so nothing is ambiguous.
      expect(thrown.notApplied).toBeTruthy();
    }
    expect(calls).toEqual([]);
  });

  it('a spawn that reports no pid throws INDETERMINATE, never a handle known to be wrong', () => {
    expect(() => ciHealDetachedProvider(ciHealPayload(), { spawnDetached: () => ({ pid: undefined }) }))
      .toThrow(/cannot be told from here/);
    let thrown;
    try { ciHealDetachedProvider(ciHealPayload(), { spawnDetached: () => ({}) }); } catch (e) { thrown = e; }
    expect(thrown.notApplied).toBeFalsy();
  });
});

describe('#3642 — PR-keyed, reason-carrying: build\'s assumptions do NOT carry over', () => {
  it('the session slug is keyed on the PR, and the dispatcher\'s and the wrapper\'s derivations AGREE', () => {
    expect(sessionSlugFor('2638', 'ci-heal', 743)).toBe('ci-heal-743');
    expect(sessionSlugFor('2638', 'ci-heal', 743, 'b')).toBe('ci-heal-743'); // no per-attempt suffix
    // …and it is NOT the fix slug, so the two repair kinds' report sidecars never collide on one PR.
    expect(sessionSlugFor('2638', 'fix', 743)).not.toBe(sessionSlugFor('2638', 'ci-heal', 743));
    // The wrapper re-derives rather than importing — so the agreement is asserted, not assumed.
    expect(planCiHealDispatchWrapper({ pr: 743, repo: 'a/b', item: '2638' }).sessionSlug)
      .toBe(sessionSlugFor('2638', 'ci-heal', 743));
    expect(assertSessionSlugAgrees('ci-heal-743', 'ci-heal-743')).toBe(true);
    expect(() => assertSessionSlugAgrees('ci-heal-743', 'fix-743')).toThrow(/disagree/);
  });

  it('the argv carries the PR AND the reason, and omits build\'s item-keyed fields', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    ciHealDetachedProvider(ciHealPayload(), { spawnDetached });
    expect(calls[0].argv.slice(1)).toEqual(['--pr=743', '--session=ci-heal-743', '--num=2638', '--reason=red-ci']);
    // The planned LANE NUMBER is deliberately not forwarded: the wrapper acquires its own lane with
    // `--base=<the PR's headRefName>`, so a pre-assigned number is one it could not honour.
    expect(calls[0].argv.join(' ')).not.toMatch(/--lane=|--attempt=|--scope=/);
  });

  it('the item and the reason are both optional — no empty flags at all', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    ciHealDetachedProvider(ciHealPayload({ num: null, reason: null }), { spawnDetached });
    expect(calls[0].argv.slice(1)).toEqual(['--pr=743', '--session=ci-heal-743']);
  });

  // mechanical-dispatcher (epic #3383, Part 2) — the DRIVER honours the target item's own `deliveryAgent:`
  // marker for `ci-heal`, exactly as it does for `build`/`fix`.
  it('appends `--provider=<marker>` when the item carries a `deliveryAgent:` marker', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    const readDeliveryAgentMarker = vi.fn(() => 'codex');
    ciHealDetachedProvider(ciHealPayload(), { spawnDetached, readDeliveryAgentMarker });
    expect(readDeliveryAgentMarker).toHaveBeenCalledWith('2638');
    expect(calls[0].argv.slice(1))
      .toEqual(['--pr=743', '--session=ci-heal-743', '--num=2638', '--reason=red-ci', '--provider=codex']);
  });

  it('adds no `--provider=` at all when the item carries no marker', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    ciHealDetachedProvider(ciHealPayload(), { spawnDetached, readDeliveryAgentMarker: () => null });
    expect(calls[0].argv.join(' ')).not.toMatch(/--provider=/);
  });

  it('the sink forwards `reason` onto the port request — the field this kind alone needs', async () => {
    const seen = [];
    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes: dispatchModesFromEnv({}),
      registry: Object.freeze({
        ...DISPATCH_PROVIDER_REGISTRY,
        'ci-heal': Object.freeze({
          ...DISPATCH_PROVIDER_REGISTRY['ci-heal'],
          provider: (r) => { seen.push(r); return 'pid:1'; },
        }),
      }),
      spawnAgent: () => 'backgrounded · 1ae0905c · x\n',
    });
    await sinks[DISPATCH_EFFECT](ciHealPayload({ reason: 'behind' }));
    expect(seen[0]).toMatchObject({ pr: 743, reason: 'behind', launchKind: 'ci-heal', num: '2638' });
  });

  it('and `reason` survives the WHOLE default path, sink → port → provider → argv', async () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: PRIMARY,
      modes: dispatchModesFromEnv({}),
      registry: registryWithSpawn(spawnDetached),
      spawnAgent: () => { throw new Error('the agent path must not be reached'); },
    });
    await sinks[DISPATCH_EFFECT](ciHealPayload({ reason: 'behind' }));
    expect(calls[0].argv).toContain('--reason=behind');
  });
});

describe('#3642 — restart survival (the parent epic\'s cross-cutting clause)', () => {
  it('spawns DETACHED, unref\'d, with stdio to a durable log — never a block inside the caller', () => {
    const recorded = [];
    const handle = ciHealDetachedProvider(ciHealPayload(), {
      spawnDetached: (argv, opts) => { recorded.push(opts); return { pid: 881, unref() { recorded.push('unref'); } }; },
    });
    expect(handle).toBe('pid:881');
    expect(recorded[0].logPath).toBe(deliveryDispatchLogPath('ci-heal-743'));
  });

  it('the DEFAULT detached spawner really passes `detached: true`, file-backed stdio, and unrefs', () => {
    // Exercise the REAL default spawner so its OPTIONS are asserted, not a stub's — `detached: true` is what
    // makes the child a new session LEADER (setsid), outside the runner's process group, so the group signal
    // `restart-runner-io.mjs` sends on shutdown never reaches a heal mid-flight.
    let seen = null;
    let unrefd = false;
    const child = defaultSpawnDetached(['/x.mjs'], { cwd: '/repo', logPath: '/tmp/x/y.log' }, {
      spawn: (bin, argv, o) => { seen = { bin, argv, o }; return { pid: 5, unref() { unrefd = true; } }; },
      ensureDir: () => {},
      openLog: () => 99,
    });
    expect(child.pid).toBe(5);
    expect(seen.o.detached).toBe(true);
    expect(seen.o.cwd).toBe('/repo');
    expect(seen.o.stdio).toEqual(['ignore', 99, 99]);
    expect(unrefd).toBe(true);
  });

  it('liveness for a detached heal is answered by the KERNEL, not by a `claude agents` listing', () => {
    expect(detachedHandlePid('pid:881')).toBe(881);
    expect(isDispatchHandleLive('pid:881', [], { isPidAlive: (p) => p === 881 })).toBe(true);
    expect(isDispatchHandleLive('pid:881', [{ sessionId: 'pid:881' }], { isPidAlive: () => false })).toBe(false);
    // The REAL probe answers about a pid that certainly exists (this process) and one that certainly does not.
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(2 ** 30)).toBe(false);
  });

  it('a RESTARTED runner still sees the in-flight heal as alive, with `claude agents` wired to THROW', () => {
    // THE PROOF, not an illustration: the listing reader is a function that throws if it is ever called. The
    // assertion is therefore "a pid handle provably never shells `claude agents`" — the read a restarted
    // runner could not make about a process it never parented — and `live: true` still comes back.
    const stamped = stampLiveness(
      {
        runs: [
          { runId: 'r1', handle: 'pid:881', startedAt: '2026-09-12T10:00:00Z' },
          { runId: 'r2', handle: 'pid:882', startedAt: '2026-09-12T10:05:00Z' },
        ],
        unreadable: 0,
      },
      {
        listAgents: () => { throw new Error('`claude agents` must not be shelled for an all-pid in-flight set'); },
        isPidAlive: (p) => p === 881,
      },
    );
    expect(stamped.runs[0].live).toBe(true);
    expect(stamped.runs[1].live).toBe(false);
    expect(stamped.livenessSource).toBe('wrapper-pid');
    expect(LIVENESS_SOURCES).toContain('wrapper-pid');
  });
});

describe('#3642 — ci-heal-run.mjs, the per-dispatch process', () => {
  it('parses the argv the provider builds, and refuses a missing required flag BY NAME', () => {
    expect(parseCiHealRunArgv(['--pr=743', '--session=ci-heal-743', '--num=2638', '--reason=red-ci']))
      .toEqual({ pr: '743', item: '2638', sessionSlug: 'ci-heal-743', repo: null, reason: 'red-ci', provider: '' });
    expect(parseCiHealRunArgv(['--pr=743', '--session=ci-heal-743']))
      .toEqual({ pr: '743', item: null, sessionSlug: 'ci-heal-743', repo: null, reason: null, provider: '' });
    expect(() => parseCiHealRunArgv(['--session=ci-heal-743'])).toThrow(/--pr=/);
    expect(() => parseCiHealRunArgv(['--pr=743'])).toThrow(/--session=/);
  });

  it('resolves the `owner/repo` slug off the checkout\'s own origin remote — both URL spellings', () => {
    expect(resolveRepoSlug('/repo', { run: () => 'git@github.com:chalbert/web-everything.git\n' }))
      .toBe('chalbert/web-everything');
    expect(resolveRepoSlug('/repo', { run: () => 'https://github.com/chalbert/web-everything\n' }))
      .toBe('chalbert/web-everything');
    // FAIL CLOSED: a wrong slug resolves a DIFFERENT repo's PR of the same number — and this arc force-pushes.
    expect(() => resolveRepoSlug('/repo', { run: () => 'not-a-remote' })).toThrow(/--repo=owner\/repo/);
  });

  it('the default path dispatches through the wrapper and reports exit 0 for every outcome it reasons about', async () => {
    const out = [];
    const { code, result } = await runCiHealCli(['--pr=743', '--session=ci-heal-743', '--num=2638', '--reason=behind'], {
      dispatch: async (o) => ({ ...o, result: 'stood-down (gate-red)' }),
      repoSlug: () => 'chalbert/web-everything',
      write: (l) => out.push(l),
      writeErr: (l) => out.push(l),
    });
    expect(code).toBe(0);
    expect(result.repo).toBe('chalbert/web-everything');
    expect(result.reason).toBe('behind');
    expect(out.join('')).toMatch(/stood-down \(gate-red\)/);
  });

  it('exits 1 when the wrapper THROWS, naming the PR', async () => {
    const err = [];
    const { code } = await runCiHealCli(['--pr=743', '--session=ci-heal-743'], {
      dispatch: async () => { throw new Error('the pool crashed'); },
      repoSlug: () => 'a/b',
      write: () => {},
      writeErr: (l) => err.push(l),
    });
    expect(code).toBe(1);
    expect(err.join('')).toMatch(/PR #743 FAILED.*the pool crashed/s);
  });

  it('REFUSES to dispatch when the two session-slug derivations disagree — it never picks one', async () => {
    const err = [];
    const dispatch = vi.fn();
    const { code } = await runCiHealCli(['--pr=743', '--session=ci-heal-99'], {
      dispatch, repoSlug: () => 'a/b', write: () => {}, writeErr: (l) => err.push(l),
    });
    expect(code).toBe(1);
    expect(dispatch).not.toHaveBeenCalled();
    expect(err.join('')).toMatch(/disagree/);
  });

  it('an explicit `--repo=` wins over the remote, and the remote is then never read', async () => {
    const { result } = await runCiHealCli(['--pr=743', '--session=ci-heal-743', '--repo=chalbert/frontierui'], {
      dispatch: async (o) => ({ ...o, result: 'ok' }),
      repoSlug: () => { throw new Error('the remote must not be read when --repo= is given'); },
      write: () => {}, writeErr: () => {},
    });
    expect(result.repo).toBe('chalbert/frontierui');
  });
});

// mechanical-dispatcher (epic #3383, Part 1) — mirrors `dispatch-lane-fix-wiring.test.mjs`'s identical suite.
describe('#3383 — ci-heal-run.mjs provider selection', () => {
  it('selects the ci-heal agent provider: flag beats env, env beats the default, and Claude IS the default', () => {
    expect(selectCiHealAgentProvider('', {}).name).toBe('claude-restricted');
    expect(selectCiHealAgentProvider('', { DELIVERY_AGENT_PROVIDER: 'codex' }).name).toBe('codex');
    expect(selectCiHealAgentProvider('codex', {}).name).toBe('codex');
    expect(selectCiHealAgentProvider('claude-restricted', { DELIVERY_AGENT_PROVIDER: 'codex' }).name)
      .toBe('claude-restricted');
    expect(selectCiHealAgentProvider('codex', {}).provider).toBe(CI_HEAL_AGENT_PROVIDERS.codex);
  });

  it('refuses an unknown provider name BEFORE any lane/rebase work happens, exiting the CLI with code 1', async () => {
    expect(() => selectCiHealAgentProvider('gemini', {})).toThrow(/unknown delivery agent provider/);
    let dispatched = false;
    const res = await runCiHealCli(['--pr=743', '--session=ci-heal-743', '--provider=gemini'], {
      repoSlug: () => 'chalbert/web-everything', write: () => {}, writeErr: () => {}, env: {},
      dispatch: async () => { dispatched = true; return { result: 'ok' }; },
    });
    expect(res).toMatchObject({ code: 1, result: null });
    expect(dispatched).toBe(false);
  });

  it('hands the CHOSEN provider to `dispatchCiHeal` as its second argument', async () => {
    let seenProvider = null;
    await runCiHealCli(['--pr=743', '--session=ci-heal-743', '--provider=codex'], {
      repoSlug: () => 'chalbert/web-everything', write: () => {}, writeErr: () => {}, env: {},
      dispatch: async (_launch, provider) => { seenProvider = provider; return { result: 'ok' }; },
    });
    expect(seenProvider).toBe(CI_HEAL_AGENT_PROVIDERS.codex);
  });
});
