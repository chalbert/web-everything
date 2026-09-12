#!/usr/bin/env node
/**
 * @file scripts/operations/prepare-decision-run.mjs
 * @description `#3644` — ONE PREPARE-DECISION, IN ITS OWN PROCESS. The restartable per-dispatch entry point
 * that `we:scripts/operations/dispatch-providers/prepare-decision.mjs#prepareDecisionDetachedProvider` spawns
 * DETACHED, and the only production caller of
 * `we:scripts/operations/prepare-decision-wrapper.mjs#prepareDecision`.
 *
 *   node scripts/operations/prepare-decision-run.mjs --num=2568 --lane=4 --session=prepare-decision-2568 \
 *     --scope='we:backlog/2568-...' --attempt=b
 *
 * Shaped exactly like `we:scripts/operations/deliver-item-run.mjs` (#3645), whose header carries the full
 * account. The short version, because it is THIS ITEM'S OWN ACCEPTANCE CLAUSE (`we:backlog/3644-*.md` "Done
 * when" 2, and the parent epic's cross-cutting criterion):
 *
 * ── WHY A SEPARATE PROCESS, AND NOT A DIRECT `prepareDecision(...)` CALL IN THE SINK ────────────────────────
 *
 * `prepareDecision` is a BLOCKING arc. Its one agent spawn is an `execFileSync` budgeted at
 * `PREPARE_DECISION_AGENT_SPAWN_TIMEOUT_MS` (60 minutes — a real prior-art survey plus authoring five forks is
 * not a 60-second turn), and the gate and the converge loop after it block for minutes more.
 *
 * WHERE A DISPATCH RUNS is what makes that load-bearing. `we:skills-src/conveyor/runner.mjs`'s
 * `makeCliDispatchPass` shells `run.mjs dispatch-lane --num=<N>` with a SYNCHRONOUS `execFileSync`, once per
 * surfaced item, INSIDE the resident runner's own tick. Calling `prepareDecision` anywhere under that call
 * would put an hour-long block inside the tick loop: the singleton lease would go un-heartbeated, every other
 * item in the tick would starve, and `run.mjs restart-runner` would SIGTERM the supervisor and take the whole
 * process tree down with it — killing a half-finished prepare: a held decision, a lane lease nobody owns, no
 * PR, and (the worst of the four) a decision left with partial forks and no record of how far the authoring
 * got.
 *
 * SO THE BLOCK LIVES HERE. This script is spawned `detached: true` (Node calls `setsid`, making it a new
 * session LEADER — it is NOT in the runner's process group, so the group signal `restart-runner-io.mjs`'s
 * shutdown sends never reaches it), `.unref()`'d, with stdout/stderr redirected to a durable log file. The
 * dispatch sink therefore still returns in MILLISECONDS, exactly as the `claude --bg` agent path did, and the
 * prepare outlives any restart of the thing that started it.
 *
 * WHAT THE DISPATCHER KEEPS TO FIND IT AGAIN. The sink records `pid:<pid>` as the effect's durable handle
 * (`dispatch-providers/prepare-decision.mjs`), which the run store persists exactly as it persisted a
 * `claude --bg` short id. After a restart the double-dispatch guard re-reads that record off disk and answers
 * liveness with a KERNEL probe (`dispatch-lane-io.mjs#isDispatchHandleLive` →
 * `detached-dispatch.mjs#defaultIsPidAlive`) instead of a `claude agents` listing — so a restarted runner
 * still sees this prepare as ALIVE and refuses to dispatch it a second time into an occupied lane. Nothing
 * about that read depends on the process that wrote it still existing.
 *
 * IT PRINTS ITS RESULT AND EXITS. No polling, no callback: the durable evidence is the PR it opens, the
 * delivery-report sidecar, and this process's own log file.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareDecision } from './prepare-decision-wrapper.mjs';

/** Refused rather than defaulted: a prepare with no item, lane or session has nothing to acquire or hold. */
const REQUIRED_FLAGS = Object.freeze(['num', 'lane', 'session']);

/**
 * PURE. `--k=v` argv → the `launch` shape {@link prepareDecision} takes, refusing a missing required flag by
 * NAME. `attempt` and `scope` are optional: a first attempt has an empty attempt tag, and `scope` rides
 * through to `lane-pool acquire --scope=` where an empty value is legal.
 *
 * @param {string[]} argv
 * @returns {{item: string, lane: string, scope: string, sessionSlug: string, attemptTag: string}}
 */
export function parsePrepareDecisionRunArgv(argv = []) {
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
      `prepare-decision-run: missing required flag(s) ${missing.map((m) => `--${m}=`).join(', ')} — `
      + 'a prepare cannot acquire a lane or hold a decision without them',
    );
  }
  return {
    item: String(flags.num).trim(),
    lane: String(flags.lane).trim(),
    scope: String(flags.scope ?? '').trim(),
    sessionSlug: String(flags.session).trim(),
    attemptTag: String(flags.attempt ?? '').trim(),
  };
}

/**
 * THE CLI, AS A FUNCTION — extracted from the `IS_CLI` block below so the argv parse, the exit-code mapping
 * and the failure text are all reachable from a test WITHOUT a subprocess and without a real `claude`.
 *
 * EXIT 1 MEANS THE PREPARE THREW, never that its outcome was disappointing. {@link prepareDecision} returns a
 * `result` string for every outcome it REASONS about (`could-not-prepare`, `gate-red`, `gate-blocked`,
 * `PR #N`) and releases the hold and lane itself in each; those are exit 0, because the mechanism worked. Only
 * a wrapper-side throw — acquire refused, hold refused, the gate script itself crashed — is a non-zero exit,
 * and the wrapper's own catch has already best-effort released what it held before it rethrows.
 *
 * @param {string[]} argv
 * @param {{prepare?: Function, write?: Function, writeErr?: Function}} [io]
 * @returns {Promise<{code: number, result: object|null}>}
 */
export async function runPrepareDecisionCli(argv = [], {
  prepare = prepareDecision,
  write = (line) => process.stdout.write(line),
  writeErr = (line) => process.stderr.write(line),
} = {}) {
  let launch;
  try {
    launch = parsePrepareDecisionRunArgv(argv);
  } catch (e) {
    writeErr(`error: ${String(e?.message ?? e)}\n`);
    return { code: 1, result: null };
  }
  write(
    `prepare-decision-run: starting prepare of #${launch.item} in lane ${launch.lane} `
    + `(session ${launch.sessionSlug}, attempt ${launch.attemptTag || '1'}) — pid ${process.pid}\n`,
  );
  try {
    const result = await prepare(launch);
    write(`prepare-decision-run: #${launch.item} finished — ${result?.result ?? '(no result reported)'}\n`);
    return { code: 0, result };
  } catch (e) {
    writeErr(
      `prepare-decision-run: #${launch.item} FAILED (hold and lane released best-effort by the wrapper): `
      + `${String(e?.message ?? e)}\n`,
    );
    return { code: 1, result: null };
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code } = await runPrepareDecisionCli(process.argv.slice(2));
  process.exitCode = code;
}
