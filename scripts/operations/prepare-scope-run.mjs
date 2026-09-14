#!/usr/bin/env node
/**
 * @file scripts/operations/prepare-scope-run.mjs
 * @description `#3641` — ONE PREPARE, IN ITS OWN PROCESS. The restartable per-dispatch entry point the
 * `prepare` dispatch provider spawns DETACHED, and the only production caller of
 * `we:scripts/operations/prepare-scope-wrapper.mjs#prepareScope`.
 *
 *   node scripts/operations/prepare-scope-run.mjs --num=3641 --lane=2 --session=prepare-3641 \
 *     --scope='we:backlog/3641-….md'
 *
 * ── WHY THIS FILE EXISTS, AND NOT JUST A DIRECT `prepareScope(...)` CALL IN THE SINK ────────────────────────
 *
 * THE RESTART-SURVIVAL REQUIREMENT — `we:backlog/3641-*.md`'s "Done when" clause 2, and the parent epic
 * `#3383`'s own cross-cutting acceptance criterion, which the card states explicitly for this item: whichever
 * shape the wrapper takes, "it must not introduce a long synchronous/blocking step inside the long-lived runner
 * process that a runner restart would lose or corrupt".
 *
 * `prepareScope` is a BLOCKING arc. Its one agent spawn is an `execFileSync` budgeted at
 * `PREPARE_AGENT_SPAWN_TIMEOUT_MS` (20 minutes), the gate that follows takes 150-350s, and
 * `open-pr --mode=label-on-green` then waits on a required CI check that routinely takes minutes more.
 *
 * WHERE A DISPATCH RUNS is what makes that fatal. `we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass`
 * shells `run.mjs dispatch-lane --num=<N>` with a SYNCHRONOUS `execFileSync`, once per surfaced item, inside
 * the resident runner's own tick. Calling `prepareScope` inline anywhere under that call would put a
 * tens-of-minutes block inside the tick loop: the singleton lease would go un-heartbeated, every other item
 * this tick would starve, and — the acceptance criterion itself — `run.mjs restart-runner`
 * (`we:scripts/operations/restart-runner-io.mjs`) would SIGTERM the supervisor, take the runner's whole process
 * tree with it, and kill a half-finished prepare: a held lane, an uncommitted `scope:` edit, no PR, and no
 * record of how far it got.
 *
 * SO THE BLOCK MOVES OUT OF THE RUNNER — the identical answer `#3645` gave for `build`
 * (`we:scripts/operations/deliver-item-run.mjs`, whose header carries the full account) and the identical shape
 * `we:scripts/operations/restart-runner-io.mjs#startSupervisor` uses for its own supervisor. This script is
 * spawned `detached: true` (Node calls `setsid`, making it a new session LEADER, so it is not in the runner's
 * process group and a group-wide signal never reaches it), `.unref()`'d, with stdout/stderr redirected to a
 * durable log file. The dispatch sink therefore still returns in milliseconds, exactly as the `claude --bg`
 * path did, and the prepare outlives any restart of the thing that started it.
 *
 * WHAT THE DISPATCHER KEEPS TO FIND IT AGAIN. The sink records `pid:<pid>` as the effect's durable handle,
 * which the run store persists exactly as it persisted a `claude --bg` short id. After a restart the guard
 * re-reads that record off disk and answers liveness with a pid probe (`process.kill(pid, 0)` — the KERNEL)
 * instead of a `claude agents` listing this process was never in, so a restarted runner still sees the
 * in-flight prepare as ALIVE and refuses to double-dispatch it. Nothing about that read depends on the process
 * that wrote it still existing.
 *
 * IT PRINTS ITS RESULT AND EXITS. There is no polling and no callback: the durable evidence a prepare produces
 * is the PR it opens, its delivery-report sidecar, and this process's own log file. The dispatch observer
 * resolves the effect off the merged PR exactly as it already did for the agent path — unchanged by this
 * wiring.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareScope } from './prepare-scope-wrapper.mjs';

/** Refused rather than defaulted: a prepare with no item, lane or session has nothing to acquire or edit. */
const REQUIRED_FLAGS = Object.freeze(['num', 'lane', 'session']);

/**
 * PURE. `--k=v` argv → the `launch` shape `prepareScope` takes, refusing a missing required flag by NAME.
 *
 * `scope` is optional: `prepareScope` derives `we:<specPath>` when it is absent, which is the same value
 * `dispatch-lane.mjs`'s dispatch step computes for a prepare anyway. There is no `attempt` flag — a prepare has
 * no retry-attempt letter (`dispatch-lane.mjs#readTick`: "only a fresh `build` dispatch mints a retry-attempt
 * letter"), so accepting one would invent a field the dispatcher never emits.
 *
 * @param {string[]} argv
 * @returns {{item: string, lane: string, scope: string, sessionSlug: string}}
 */
export function parsePrepareScopeRunArgv(argv = []) {
  const flags = {};
  for (const a of Array.isArray(argv) ? argv : []) {
    if (typeof a !== 'string' || !a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = 'true';
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const missing = REQUIRED_FLAGS.filter((name) => !String(flags[name] ?? '').trim());
  if (missing.length) {
    throw new TypeError(
      `prepare-scope-run: missing required flag(s) ${missing.map((m) => `--${m}=`).join(', ')} — `
      + 'a prepare cannot acquire a lane or locate its backlog file without them',
    );
  }
  return {
    item: String(flags.num).trim(),
    lane: String(flags.lane).trim(),
    scope: String(flags.scope ?? '').trim(),
    sessionSlug: String(flags.session).trim(),
  };
}

/**
 * THE CLI, AS A FUNCTION — extracted for the same reason `deliver-item-run.mjs#runDeliverItemCli` and
 * `review-dispatch.mjs#dispatchReviewCli` are: the argv parse, the exit-code mapping and the failure text are
 * all reachable from a test WITHOUT a subprocess and without a real `claude`.
 *
 * EXIT 1 MEANS THE PREPARE THREW, never that its outcome was disappointing. `prepareScope` returns a `result`
 * string for every outcome it reasons about (`could-not-predict`, `gate-red`, `gate-blocked`, `scope → PR #N`)
 * and releases the lane itself in each; those are exit 0, because the mechanism worked. Only a wrapper-side
 * throw — acquire refused, the agent crashed with no report, the one-file guardrail refused — is a non-zero
 * exit, and `prepareScope`'s own catch has already best-effort released the lane before it rethrows.
 *
 * @param {string[]} argv
 * @param {{prepare?: Function, write?: Function, writeErr?: Function}} [io]
 * @returns {Promise<{code: number, result: object|null}>}
 */
export async function runPrepareScopeCli(argv = [], {
  prepare = prepareScope,
  write = (line) => process.stdout.write(line),
  writeErr = (line) => process.stderr.write(line),
} = {}) {
  let launch;
  try {
    launch = parsePrepareScopeRunArgv(argv);
  } catch (e) {
    writeErr(`error: ${String(e?.message ?? e)}\n`);
    return { code: 1, result: null };
  }
  write(
    `prepare-scope-run: starting scope prediction for #${launch.item} in lane ${launch.lane} `
    + `(session ${launch.sessionSlug}) — pid ${process.pid}\n`,
  );
  try {
    const result = await prepare(launch);
    write(`prepare-scope-run: #${launch.item} finished — ${result?.result ?? '(no result reported)'}\n`);
    return { code: 0, result };
  } catch (e) {
    writeErr(
      `prepare-scope-run: #${launch.item} FAILED (lane released best-effort by the wrapper): `
      + `${String(e?.message ?? e)}\n`,
    );
    return { code: 1, result: null };
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code } = await runPrepareScopeCli(process.argv.slice(2));
  process.exitCode = code;
}
