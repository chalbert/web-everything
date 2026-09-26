/**
 * @file scripts/operations/dispatch-provider-registry.mjs
 * @description WHICH LAUNCH KINDS HAVE A MECHANICAL DISPATCH PROVIDER, AND HOW EACH ONE IS OPTED OUT OF — one
 *   frozen table plus pure lookups, in the shape `we:scripts/lib/constellation-repos.mjs` already uses for a
 *   small typed registry: a `Object.freeze`d map, lookups that FAIL CLOSED, and no consumer keeping its own
 *   copy of a key literal.
 *
 * ── THE PROBLEM THIS TABLE EXISTS TO REMOVE ─────────────────────────────────────────────────────────────────
 *
 * #3645 wired ONE launch kind (`build`) to a mechanical provider, with a hard-coded branch in the io shell's
 * router — `if (kind === 'build' && buildMode !== 'agent')` — and a hard-coded `WE_BUILD_DISPATCH_MODE` read
 * inside `createDispatchSinks`. Four sibling kinds are being wired by four separate lanes (`prepare` #3641,
 * `prepare-decision` #3644, `fix` #3640, `ci-heal` #3642, under `we:backlog/3643-*.md`). Five copies of that
 * branch and five env reads all land on the same handful of lines in the same 2000-line file, so the lanes
 * serialize on a textual conflict that has nothing to do with the work. With the table, ADDING A KIND IS
 * ADDING A ROW: no router edit, no sink edit, no new conditional anywhere.
 *
 * ── REGISTERING A NEW KIND ──────────────────────────────────────────────────────────────────────────────────
 *
 *   1. Create `we:scripts/operations/dispatch-providers/<kind>.mjs` exporting a provider with the port
 *      signature `(request, io?) => string` — a DURABLE handle a later liveness read can resolve. Copy
 *      {@link ./dispatch-providers/build.mjs}; its docblock states the contract in full.
 *   2. Import that provider here.
 *   3. Add ONE entry to {@link DISPATCH_PROVIDER_REGISTRY}.
 *
 * Nothing else. In particular nothing in {@link ./dispatch-lane-io.mjs} changes — {@link
 * ./dispatch-lane-io.mjs#routeDispatchProvider} reads this table and has no per-kind knowledge at all, and the
 * sink reads every registered kind's mode through {@link dispatchModesFromEnv} without naming one.
 *
 * ── THE ENTRY SHAPE ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *     {
 *       kind: 'build',                         // the LAUNCH_KINDS member this entry dispatches
 *       provider: deliverItemDetachedProvider, // (request, io?) => durable handle string
 *       modeEnv: 'WE_BUILD_DISPATCH_MODE',     // the opt-out env var; `null` => no opt-out, always mechanical
 *       defaultMode: 'agent',                  // what an unset/empty `modeEnv` means (see LANDED OFF below)
 *       runScript: DELIVER_ITEM_RUN_SCRIPT,    // the per-dispatch process the provider starts (#3906)
 *     }
 *
 * `modeEnv: null` is a real and deliberate option, not a placeholder: a kind whose mechanical path has no
 * fallback agent brief has nothing to opt out TO, and saying so in the table is better than registering an env
 * var nobody implements the other side of.
 *
 * ── FAIL CLOSED, WHICH HERE MEANS "TAKE THE AGENT PATH" ─────────────────────────────────────────────────────
 *
 * {@link dispatchProviderEntry} returns `null` for an unregistered kind rather than defaulting to any entry —
 * the same discipline `constellation-repos.mjs#repoKeyForDir` states ("never a silent fall back to `we`"). The
 * safe direction differs per registry, and here `null` means "this kind has no mechanical provider, so it
 * takes the unchanged `claude --bg` agent path", which is PRECISELY today's behaviour for the five kinds that
 * are not `build`. A lookup that guessed an entry would dispatch a `fix` through the delivery wrapper.
 *
 * ── LANDED OFF ON MAIN (#3906) ──────────────────────────────────────────────────────────────────────────────
 *
 * On the prototype every row defaults to `mechanical`. On main every row defaults to `agent`, so an unset
 * environment dispatches exactly as main did before this table existed: the `claude --bg` agent path, for all
 * six kinds. The reason is not caution for its own sake. Each provider starts a `*-run.mjs` script
 * (`runScript` below) that graduates with its OWN card (#3903 build, #3904 fix and ci-heal, #3905 prepare and
 * prepare-decision). A row whose script is not on disk has nothing to run, so
 * {@link ./dispatch-lane-io.mjs#routeDispatchProvider} refuses a `mechanical` row whose `runScript` is missing
 * before any process exists. Flipping a row to `mechanical` by default is that row's own card's one-line change.
 *
 * PURE. No process, no fs, no clock. The only environment this module reads is the one it is HANDED.
 */

import { LAUNCH_KINDS } from './dispatch-lane.mjs';
import { DELIVER_ITEM_RUN_SCRIPT, deliverItemDetachedProvider } from './dispatch-providers/build.mjs';
import { FIX_RUN_SCRIPT, fixDetachedProvider } from './dispatch-providers/fix.mjs';
import { CI_HEAL_RUN_SCRIPT, ciHealDetachedProvider } from './dispatch-providers/ci-heal.mjs';
import { PREPARE_SCOPE_RUN_SCRIPT, prepareScopeDetachedProvider } from './dispatch-providers/prepare.mjs';
import { PREPARE_DECISION_RUN_SCRIPT, prepareDecisionDetachedProvider } from './dispatch-providers/prepare-decision.mjs';

/**
 * THE TABLE — launch kind → its mechanical dispatch provider and how an operator opts out of it. Frozen, and
 * the ONE place a kind's mechanical wiring is declared; every consumer looks up through the functions below
 * rather than reaching in with a literal key.
 *
 * IT HOLDS FIVE ENTRIES, ALL LANDED OFF (`defaultMode: 'agent'`, see the file docblock): #3645 wired
 * `build`, #3641 wired `prepare`, #3640 wired `fix`, #3644 wired `prepare-decision` and #3642 wired
 * `ci-heal`, because those are the five kinds with a wrapper
 * (`we:scripts/operations/deliver-item-wrapper.mjs`, `we:scripts/operations/prepare-scope-wrapper.mjs`,
 * `we:scripts/operations/fix-dispatch-wrapper.mjs`, `we:scripts/operations/prepare-decision-wrapper.mjs`,
 * `we:scripts/operations/ci-heal-dispatch-wrapper.mjs`) owning their lifecycle. The remaining ONE —
 * `investigate` — still spawns its own agent from its own brief, whose first steps (`lane-pool acquire`,
 * `verify-lane`, `run.mjs open-pr`) the agent itself runs.
 *
 * @type {Readonly<Record<string, Readonly<{kind: string, provider: Function, modeEnv: string|null, defaultMode: 'mechanical'|'agent', runScript: string}>>>}
 */
export const DISPATCH_PROVIDER_REGISTRY = Object.freeze({
  build: Object.freeze({
    kind: 'build',
    provider: deliverItemDetachedProvider,
    modeEnv: 'WE_BUILD_DISPATCH_MODE',
    defaultMode: 'agent',
    runScript: DELIVER_ITEM_RUN_SCRIPT,
  }),
  // #3641 — the prepare-scope wrapper. `modeEnv` is a REAL opt-out here, not a formality: the pre-#3641 brief
  // (`we:skills-src/conveyor/prepare-scope-agent-brief.md`) is kept, and carries a header saying it is the
  // path `WE_PREPARE_DISPATCH_MODE=agent` selects.
  prepare: Object.freeze({
    kind: 'prepare',
    provider: prepareScopeDetachedProvider,
    modeEnv: 'WE_PREPARE_DISPATCH_MODE',
    defaultMode: 'agent',
    runScript: PREPARE_SCOPE_RUN_SCRIPT,
  }),
  // #3640 — the fix wrapper. Its own opt-out brief is `we:skills-src/conveyor/fix-agent-brief.md`, which
  // carries a header saying it is the path `WE_FIX_DISPATCH_MODE=agent` selects.
  fix: Object.freeze({
    kind: 'fix',
    provider: fixDetachedProvider,
    modeEnv: 'WE_FIX_DISPATCH_MODE',
    defaultMode: 'agent',
    runScript: FIX_RUN_SCRIPT,
  }),
  // #3644 — the prepare-decision wrapper. Same real opt-out, same reason: the prose brief
  // (`we:skills-src/conveyor/prepare-decision-agent-brief.md`) is kept and carries a FALLBACK-PATH header
  // naming `WE_PREPARE_DECISION_DISPATCH_MODE=agent` as the path that selects it.
  'prepare-decision': Object.freeze({
    kind: 'prepare-decision',
    provider: prepareDecisionDetachedProvider,
    modeEnv: 'WE_PREPARE_DECISION_DISPATCH_MODE',
    defaultMode: 'agent',
    runScript: PREPARE_DECISION_RUN_SCRIPT,
  }),
  // #3642 — the ci-heal wrapper, the OTHER PR-keyed repair kind. Same real opt-out, same reason: the prose
  // brief (`we:skills-src/conveyor/fix-agent-ci-brief.md`) is kept and carries a FALLBACK-PATH header naming
  // `WE_CI_HEAL_DISPATCH_MODE=agent` as the path that selects it.
  'ci-heal': Object.freeze({
    kind: 'ci-heal',
    provider: ciHealDetachedProvider,
    modeEnv: 'WE_CI_HEAL_DISPATCH_MODE',
    defaultMode: 'agent',
    runScript: CI_HEAL_RUN_SCRIPT,
  }),
});

/**
 * EVERY REGISTERED KEY MUST BE A LAUNCH KIND — checked HERE, at module load, not at dispatch.
 *
 * A row for a kind `dispatch-lane` refuses to dispatch is a bug that can otherwise sit in the table unnoticed
 * for as long as nobody dispatches that kind: the lookup simply never fires, the provider never runs, and the
 * entry reads as working wiring in review. Importing this module is enough to surface it, which means the
 * first test that touches dispatch catches a typo'd or renamed kind rather than a live tick doing so.
 */
for (const key of Object.keys(DISPATCH_PROVIDER_REGISTRY)) {
  if (!LAUNCH_KINDS.includes(key)) {
    throw new TypeError(
      `operations: dispatch-provider-registry has an entry for ${JSON.stringify(key)}, which is not a launch `
      + `kind — LAUNCH_KINDS is [${LAUNCH_KINDS.join(', ')}]. A provider for a kind the operation refuses to `
      + 'dispatch can never run.',
    );
  }
  const entry = DISPATCH_PROVIDER_REGISTRY[key];
  if (entry.kind !== key) {
    throw new TypeError(
      `operations: dispatch-provider-registry entry ${JSON.stringify(key)} declares kind `
      + `${JSON.stringify(entry.kind)} — the key and the entry's own \`kind\` must agree, or a lookup and the `
      + 'thing it found disagree about what was dispatched.',
    );
  }
}

/**
 * THE LOOKUP. Returns the entry for a launch kind, or `null` when the kind has no mechanical provider.
 *
 * FAIL CLOSED: `null` is not an error and not a default — it is the answer "take the agent path", which is
 * exactly what every unregistered kind does today. See the file docblock for why guessing an entry would be
 * worse than returning nothing.
 *
 * PURE, and the `registry` seam is here so a test can hand in a table rather than mutate the frozen one.
 *
 * @param {string} kind - a `LAUNCH_KINDS` member.
 * @param {Record<string, object>} [registry]
 * @returns {{kind: string, provider: Function, modeEnv: string|null, defaultMode: string}|null}
 */
export function dispatchProviderEntry(kind, registry = DISPATCH_PROVIDER_REGISTRY) {
  const key = String(kind ?? '');
  if (!key) return null;
  // `Object.hasOwn`, not `registry[key]` — an inherited `toString`/`constructor` must not read as an entry.
  return Object.hasOwn(registry, key) ? registry[key] : null;
}

/**
 * WHICH PATH A REGISTERED KIND'S DISPATCH TAKES. `mechanical` (the default) runs that kind's provider;
 * `agent` restores the `claude --bg` + full-brief spawn.
 *
 * The reasoning is #3645's, and is kept verbatim because it is what the whole wiring is FOR:
 *
 * > READ FROM THE ENVIRONMENT, for the same reason `AGENT_ARGS_ENV` is: a knob only a test can reach is not
 * > a knob, and the `dispatch-lane` operation's declared input has no field for this (its input is the tick's,
 * > not the operator's). An unrecognised value THROWS rather than falling back to either path — a typo'd
 * > `WE_BUILD_DISPATCH_MODE=mechnical` silently taking the agent path is exactly the class of failure this whole
 * > wiring exists to remove.
 *
 * Generalised from `build` to any entry, that means: the value is trimmed and lower-cased (so
 * ` MECHANICAL ` is accepted, a shell that exports with a stray space is not a fresh failure mode), an
 * unset or empty value means `entry.defaultMode`, and ANYTHING ELSE throws a `TypeError` naming the env var
 * and both legal values — because the one thing a mode knob must never do is silently pick a side.
 *
 * PURE: `env` is data. Nothing here reads `process.env` on its own.
 *
 * @param {{kind: string, modeEnv: string|null, defaultMode: string}} entry
 * @param {Record<string, string|undefined>} [env]
 * @returns {'mechanical'|'agent'}
 */
export function dispatchModeFor(entry, env = {}) {
  const fallback = entry?.defaultMode === 'agent' ? 'agent' : 'mechanical';
  // `modeEnv: null` — this kind has no opt-out at all, so there is no value to read and no typo to catch.
  if (!entry?.modeEnv) return fallback;
  const raw = String(env?.[entry.modeEnv] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw !== 'mechanical' && raw !== 'agent') {
    throw new TypeError(
      `operations: ${entry.modeEnv} must be \`mechanical\` (the default — the ${entry.kind} kind's own `
      + `mechanical provider) or \`agent\` (the full-brief \`claude --bg\` spawn), got ${JSON.stringify(raw)}`,
    );
  }
  return raw;
}

/**
 * EVERY REGISTERED KIND'S MODE, READ ONCE.
 *
 * WHY ONCE, AND WHY AT CONSTRUCTION TIME. This is what {@link ./dispatch-lane-io.mjs#createDispatchSinks}
 * calls when it is built, not what the router calls per dispatch — #3645's own reasoning, now covering every
 * kind rather than `build` alone: a single tick must not be able to straddle two modes. If the router read the
 * environment per dispatch, an operator exporting `WE_BUILD_DISPATCH_MODE=agent` halfway through a tick would
 * get a tick whose first items went mechanically and whose rest did not, which is the hardest possible thing
 * to reason about from the outside. Reading once makes a mode change take effect at the NEXT tick, wholly.
 *
 * A TYPO IN ANY ONE KIND'S VAR THROWS HERE, before a single dispatch — see {@link dispatchModeFor}. That is
 * the intended blast radius: the sink refuses to be built at all rather than building one that quietly routes
 * the wrong way.
 *
 * @param {Record<string, string|undefined>} [env] - defaults to `process.env`; a test injects a plain object.
 * @param {Record<string, object>} [registry]
 * @returns {Record<string, 'mechanical'|'agent'>} a plain (unfrozen) map, kind → mode.
 */
export function dispatchModesFromEnv(env = process.env, registry = DISPATCH_PROVIDER_REGISTRY) {
  const modes = {};
  for (const [kind, entry] of Object.entries(registry)) modes[kind] = dispatchModeFor(entry, env);
  return modes;
}
