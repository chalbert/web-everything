/**
 * @file dispatch-provider-registry.test.mjs — the per-kind mechanical DISPATCH PROVIDER TABLE.
 *
 * WHAT THIS FILE PROVES, and why each clause is here rather than "the table is importable":
 *
 *   1. **THE TABLE ONLY NAMES KINDS THE OPERATION WILL DISPATCH.** A row for a kind outside `LAUNCH_KINDS` can
 *      never fire, so it reads as working wiring in review while doing nothing. The registry checks this at
 *      module LOAD; this file pins that the check is real.
 *   2. **THE UNREGISTERED KINDS ARE A DELIBERATE TRIPWIRE.** Four sibling lanes were wiring `prepare` (#3641,
 *      LANDED — off the list below), `prepare-decision` (#3644, LANDED — likewise), `fix` (#3640, LANDED) and
 *      `ci-heal` (#3642, LANDED — the last of the four). Each one that lands flips ONE line here, on purpose — the list below is the ledger
 *      of what is still on the agent path, and it should have to be edited rather than silently drift. This
 *      file is the ONE place that enumeration lives: every other routing test asserts the INVARIANT (routed
 *      mechanically iff registered) rather than a snapshot, so a landing kind edits one line, here, and
 *      nothing else.
 *   3. **A TYPO'D MODE STILL THROWS.** #3645's whole reason for the knob: `WE_BUILD_DISPATCH_MODE=mechnical`
 *      silently taking the agent path is the failure class the wiring exists to remove. Generalising the read
 *      from one kind to a table must not soften it.
 *   4. **THE REGISTRY IS LIVE BY DEFAULT, NOT MERELY PRESENT.** The load-bearing assertion: a `build` launch
 *      through `createDispatchSinks` with NO injected `provider` and an EMPTY environment reaches the `build`
 *      entry's provider, and never `spawnAgent`. A table that were correct but unconsulted would pass every
 *      other test in this file.
 *
 * NOTHING HERE SPAWNS A PROCESS. The detached spawn is injected through the registry's own `provider` seam, per
 * the same discipline `./dispatch-lane.test.mjs` and `./dispatch-lane-build-wiring.test.mjs` state in theirs.
 */

import { describe, it, expect } from 'vitest';

import {
  DISPATCH_PROVIDER_REGISTRY,
  dispatchModeFor,
  dispatchModesFromEnv,
  dispatchProviderEntry,
} from '../dispatch-provider-registry.mjs';
import { deliverItemDetachedProvider } from '../dispatch-providers/build.mjs';
import { fixDetachedProvider } from '../dispatch-providers/fix.mjs';
import { prepareDecisionDetachedProvider } from '../dispatch-providers/prepare-decision.mjs';
import { BUILD_DISPATCH_MODE_ENV, createDispatchSinks, routeDispatchProvider } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT, LAUNCH_KINDS } from '../dispatch-lane.mjs';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step emits, trimmed to what a provider reads. */
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

/** THE LEDGER OF WHAT IS STILL ON THE AGENT PATH. One line flips per sibling lane — see the header.
 *  `prepare` left this list in #3641 (`we:scripts/operations/prepare-scope-wrapper.mjs`), `fix` in #3640
 *  (`we:scripts/operations/fix-dispatch-wrapper.mjs`), `prepare-decision` in #3644
 *  (`we:scripts/operations/prepare-decision-wrapper.mjs`) and `ci-heal` in #3642
 *  (`we:scripts/operations/ci-heal-dispatch-wrapper.mjs`). `investigate` is the last one left. */
const UNREGISTERED_KINDS = ['investigate'];

/** A stable, non-lane-shaped root for every `createDispatchSinks` call in this file — see the identical
 *  constant + rationale in `./dispatch-lane-build-wiring.test.mjs` (#3637's 16-test false-failure regression):
 *  `assertNotALaneCheckout` fires on the checkout's own on-disk BASENAME, which this test never means to
 *  exercise, so a fixed fake root keeps it hermetic to where it happens to be checked out. */
const PRIMARY = '/primary/webeverything';

/** Every registered kind's mode with NOTHING set in the environment — derived from the table rather than
 *  written out, so a landing sibling lane edits the ledger above and nothing else (#3641). */
const defaultModes = () => Object.fromEntries(
  Object.entries(DISPATCH_PROVIDER_REGISTRY).map(([kind, entry]) => [kind, entry.defaultMode]),
);

describe('the dispatch provider registry — the table', () => {
  it('names ONLY launch kinds, and each entry agrees with its own key', () => {
    for (const [key, entry] of Object.entries(DISPATCH_PROVIDER_REGISTRY)) {
      expect(LAUNCH_KINDS).toContain(key);
      expect(entry.kind).toBe(key);
      expect(typeof entry.provider).toBe('function');
      expect(entry.defaultMode === 'mechanical' || entry.defaultMode === 'agent').toBe(true);
      // `null` is legal (no opt-out); a non-empty string is the env var. An empty string is neither.
      expect(entry.modeEnv === null || (typeof entry.modeEnv === 'string' && entry.modeEnv.length > 0)).toBe(true);
    }
  });

  it('is FROZEN — a consumer cannot register a kind by mutating the table it was handed', () => {
    expect(Object.isFrozen(DISPATCH_PROVIDER_REGISTRY)).toBe(true);
    expect(Object.isFrozen(DISPATCH_PROVIDER_REGISTRY.build)).toBe(true);
  });

  it('and the io shell\'s back-compat `BUILD_DISPATCH_MODE_ENV` literal has NOT drifted from the entry', () => {
    // `dispatch-lane-io.mjs` re-states the name rather than reading it off the entry, because the two modules
    // sit in an import cycle and a load-time read across it is order-dependent. Its docblock says so and points
    // here: this assertion is what keeps the restated copy honest.
    expect(BUILD_DISPATCH_MODE_ENV).toBe(DISPATCH_PROVIDER_REGISTRY.build.modeEnv);
  });

  it('holds `fix`, wired to the fix wrapper behind `WE_FIX_DISPATCH_MODE` (#3640)', () => {
    expect(dispatchProviderEntry('fix')).toEqual({
      kind: 'fix',
      provider: fixDetachedProvider,
      modeEnv: 'WE_FIX_DISPATCH_MODE',
      defaultMode: 'mechanical',
    });
  });

  it('holds `build`, wired to the deliver-item wrapper behind `WE_BUILD_DISPATCH_MODE`', () => {
    expect(dispatchProviderEntry('build')).toEqual({
      kind: 'build',
      provider: deliverItemDetachedProvider,
      modeEnv: 'WE_BUILD_DISPATCH_MODE',
      defaultMode: 'mechanical',
    });
  });

  it('holds `prepare-decision`, wired to the prepare wrapper behind `WE_PREPARE_DECISION_DISPATCH_MODE` (#3644)', () => {
    expect(dispatchProviderEntry('prepare-decision')).toEqual({
      kind: 'prepare-decision',
      provider: prepareDecisionDetachedProvider,
      modeEnv: 'WE_PREPARE_DECISION_DISPATCH_MODE',
      defaultMode: 'mechanical',
    });
  });
});

describe('dispatchProviderEntry — FAIL CLOSED', () => {
  it('returns null for every kind with no mechanical provider yet — the sibling-lane tripwire', () => {
    // The ledger itself is asserted, so a kind landing its wiring has to come here and say so.
    expect(LAUNCH_KINDS.filter((k) => !Object.hasOwn(DISPATCH_PROVIDER_REGISTRY, k))).toEqual(UNREGISTERED_KINDS);
    for (const kind of UNREGISTERED_KINDS) expect(dispatchProviderEntry(kind)).toBeNull();
  });

  it('returns null — never a default entry — for an unknown, empty or inherited key', () => {
    expect(dispatchProviderEntry('not-a-kind')).toBeNull();
    expect(dispatchProviderEntry('')).toBeNull();
    expect(dispatchProviderEntry(undefined)).toBeNull();
    // A prototype member must not read as a registration.
    expect(dispatchProviderEntry('toString')).toBeNull();
    expect(dispatchProviderEntry('constructor')).toBeNull();
  });

  it('looks up in the registry it is HANDED, so a test never has to mutate the frozen one', () => {
    const fake = Object.freeze({ 'ci-heal': { kind: 'ci-heal', provider: () => 'x', modeEnv: null, defaultMode: 'mechanical' } });
    expect(dispatchProviderEntry('ci-heal', fake).kind).toBe('ci-heal');
    expect(dispatchProviderEntry('build', fake)).toBeNull();
  });
});

describe('dispatchModeFor — a typo must never pick a path', () => {
  const entry = dispatchProviderEntry('build');

  it('defaults to the entry default when the var is unset or empty, and accepts both legal values', () => {
    expect(dispatchModeFor(entry, {})).toBe('mechanical');
    expect(dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: '' })).toBe('mechanical');
    expect(dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: '   ' })).toBe('mechanical');
    expect(dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: 'agent' })).toBe('agent');
    expect(dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: ' MECHANICAL ' })).toBe('mechanical');
  });

  it('THROWS on anything else, naming the env var and both legal values', () => {
    expect(() => dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: 'mechnical' })).toThrow(TypeError);
    expect(() => dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: 'mechnical' }))
      .toThrow(/WE_BUILD_DISPATCH_MODE must be .*mechanical.*agent/s);
    // The rejected value is named too — a message that hides it sends the operator hunting.
    expect(() => dispatchModeFor(entry, { WE_BUILD_DISPATCH_MODE: 'mechnical' })).toThrow(/mechnical/);
  });

  it('`modeEnv: null` means no opt-out at all — the default, with nothing read and nothing to typo', () => {
    const noOptOut = { kind: 'ci-heal', provider: () => 'x', modeEnv: null, defaultMode: 'mechanical' };
    expect(dispatchModeFor(noOptOut, { WE_BUILD_DISPATCH_MODE: 'agent' })).toBe('mechanical');
    expect(dispatchModeFor(noOptOut, { FIX: 'nonsense' })).toBe('mechanical');
  });
});

describe('dispatchModesFromEnv — read ONCE, over every registered kind', () => {
  it('answers for every registered kind from the env it is handed', () => {
    expect(dispatchModesFromEnv({})).toEqual(defaultModes());
    expect(dispatchModesFromEnv({ WE_BUILD_DISPATCH_MODE: 'agent' })).toEqual({ ...defaultModes(), build: 'agent' });
    // One kind's opt-out moves ONLY that kind — the reason the modes are a map and not a scalar (#3640/#3644),
    // and a thing a single-entry table could not have shown.
    expect(dispatchModesFromEnv({ WE_FIX_DISPATCH_MODE: 'agent' })).toEqual({ ...defaultModes(), fix: 'agent' });
    expect(dispatchModesFromEnv({ WE_PREPARE_DECISION_DISPATCH_MODE: 'agent' }))
      .toEqual({ ...defaultModes(), 'prepare-decision': 'agent' });
    expect(Object.keys(dispatchModesFromEnv({}))).toEqual(Object.keys(DISPATCH_PROVIDER_REGISTRY));
  });

  it('reads each kind\'s var EXACTLY ONCE, so one tick cannot straddle two modes', () => {
    const reads = [];
    // A Proxy counts the reads the map actually performs — a per-dispatch read would show up as many.
    const env = new Proxy({ WE_BUILD_DISPATCH_MODE: 'agent' }, {
      get(target, prop) { reads.push(prop); return target[prop]; },
    });
    expect(dispatchModesFromEnv(env)).toEqual({ ...defaultModes(), build: 'agent' });
    expect(reads.filter((p) => p === 'WE_BUILD_DISPATCH_MODE')).toHaveLength(1);
    // And every OTHER registered kind's var is read exactly once too — the "read ONCE, over every registered
    // kind" half of this function's name, which a single-entry table could not have shown.
    for (const entry of Object.values(DISPATCH_PROVIDER_REGISTRY)) {
      if (entry.modeEnv) expect(reads.filter((p) => p === entry.modeEnv)).toHaveLength(1);
    }
  });

  it('walks the registry it is handed, not the real one', () => {
    const fake = Object.freeze({
      'ci-heal': { kind: 'ci-heal', provider: () => 'x', modeEnv: 'WE_CI_HEAL_DISPATCH_MODE', defaultMode: 'mechanical' },
    });
    expect(dispatchModesFromEnv({ WE_CI_HEAL_DISPATCH_MODE: 'agent' }, fake)).toEqual({ 'ci-heal': 'agent' });
  });

  it('a typo in ANY kind\'s var throws HERE, before a single dispatch', () => {
    expect(() => dispatchModesFromEnv({ WE_BUILD_DISPATCH_MODE: 'mechnical' })).toThrow(/must be/);
  });
});

describe('routeDispatchProvider — the registry is the only per-kind knowledge', () => {
  const agentSpy = (seen) => (r) => { seen.push(['agent', r.launchKind]); return 'abc'; };

  it('routes a REGISTERED kind to its entry\'s provider by default', () => {
    const seen = [];
    const registry = Object.freeze({
      build: { kind: 'build', provider: (r) => { seen.push(['entry', r.launchKind]); return 'pid:1'; }, modeEnv: 'X', defaultMode: 'mechanical' },
    });
    const handle = routeDispatchProvider({ launchKind: 'build' }, { registry, agent: agentSpy(seen) });
    expect(handle).toBe('pid:1');
    expect(seen).toEqual([['entry', 'build']]);
  });

  it('routes a registered kind to the AGENT path under `modes[kind] === \'agent\'`', () => {
    const seen = [];
    const registry = Object.freeze({
      build: { kind: 'build', provider: () => { seen.push(['entry', 'build']); return 'pid:1'; }, modeEnv: 'X', defaultMode: 'mechanical' },
    });
    const handle = routeDispatchProvider({ launchKind: 'build' }, {
      registry, modes: { build: 'agent' }, agent: agentSpy(seen),
    });
    expect(handle).toBe('abc');
    expect(seen).toEqual([['agent', 'build']]);
  });

  it('routes EVERY unregistered kind to the agent path, and the mode map for them is irrelevant', () => {
    const seen = [];
    for (const kind of UNREGISTERED_KINDS) {
      routeDispatchProvider({ launchKind: kind, num: '1', lane: 1, sessionSlug: 's' }, {
        // Even a `mechanical` mode cannot conjure a provider for a kind with no row.
        modes: Object.fromEntries(LAUNCH_KINDS.map((k) => [k, 'mechanical'])),
        agent: agentSpy(seen),
      });
    }
    expect(seen.map(([, k]) => k)).toEqual(UNREGISTERED_KINDS);
  });

  it('a missing `launchKind` is `build`, exactly as before the registry', () => {
    const seen = [];
    const registry = Object.freeze({
      build: { kind: 'build', provider: () => { seen.push('entry'); return 'pid:1'; }, modeEnv: 'X', defaultMode: 'mechanical' },
    });
    expect(routeDispatchProvider({}, { registry, agent: agentSpy(seen) })).toBe('pid:1');
    expect(seen).toEqual(['entry']);
  });
});

describe('THE DEFAULT PATH — the registry is LIVE, not merely present', () => {
  it('a DEFAULT sink with an EMPTY env routes a `build` launch to the registry\'s mechanical provider', async () => {
    const spawnAgentCalls = [];
    const spawnedDetached = [];
    // The REAL `build` entry, with ONLY its process boundary swapped — so what is under test is the wiring
    // (sink → registry → entry.provider), not a stand-in provider that proves nothing about the default.
    const registry = Object.freeze({
      ...DISPATCH_PROVIDER_REGISTRY,
      build: Object.freeze({
        ...DISPATCH_PROVIDER_REGISTRY.build,
        provider: (request) => deliverItemDetachedProvider(request, {
          spawnDetached: (argv, opts) => { spawnedDetached.push({ argv, opts }); return { pid: 9100, unref() {} }; },
        }),
      }),
    });

    const sinks = createDispatchSinks({
      root: PRIMARY,
      // NO `provider` and NO `buildMode` — the sink resolves the mode itself, from an environment with nothing
      // in it, and installs its own router over the table.
      modes: dispatchModesFromEnv({}),
      registry,
      // The agent path fully wired and fully able to answer, so a failure here is "it was not called", never
      // "it could not have been called".
      spawnAgent: (argv, opts) => { spawnAgentCalls.push({ argv, opts }); return 'backgrounded · 1ae0905c · x\n'; },
    });

    const result = await sinks[DISPATCH_EFFECT](buildPayload());

    expect(spawnedDetached).toHaveLength(1);
    expect(spawnedDetached[0].argv).toEqual(expect.arrayContaining(['--num=3645', '--lane=4']));
    // THE OLD PATH WAS NEVER TAKEN.
    expect(spawnAgentCalls).toEqual([]);
    // The sink's contract is unchanged: an in-flight marker carrying a durable handle and a deadline.
    expect(result.handle).toBe('pid:9100');
    expect(result.expectedBy).toEqual(expect.any(String));
  });

  it('and the REAL table\'s `build` provider is the deliver-item wrapper — the half the test above swaps out', () => {
    // Together with the test above this is the whole claim: the sink consults the table, and the table points
    // at the wrapper. Asserting identity here is what lets that test inject a spawn without weakening it.
    expect(DISPATCH_PROVIDER_REGISTRY.build.provider).toBe(deliverItemDetachedProvider);
  });

  it('an EMPTY env means `mechanical` for every registered kind — nothing has to be set for this to be live', () => {
    expect(dispatchModesFromEnv({})).toEqual(defaultModes());
    // Derived, but not vacuous: every entry in the real table must actually default to the mechanical path,
    // which is the claim this test's name makes.
    expect(Object.values(dispatchModesFromEnv({})).every((m) => m === 'mechanical')).toBe(true);
    expect(Object.keys(dispatchModesFromEnv({})).length).toBeGreaterThan(0);
  });
});
