#!/usr/bin/env node
/**
 * @file scripts/operations/deliver-item-run.mjs
 * @description `#3645` — ONE DELIVERY, IN ITS OWN PROCESS. The restartable per-dispatch entry point that
 * `we:scripts/operations/dispatch-lane-io.mjs#deliverItemDetachedProvider` spawns DETACHED, and the only
 * production caller of `we:scripts/operations/deliver-item-wrapper.mjs#deliverItem`.
 *
 *   node scripts/operations/deliver-item-run.mjs --num=3645 --lane=2 --session=conveyor-3645 \
 *     --scope='we:scripts/...' --attempt=b
 *
 * ── WHY THIS FILE EXISTS AT ALL, AND NOT JUST A DIRECT `deliverItem(...)` CALL IN THE SINK ──────────────────
 *
 * THE RESTART-SURVIVAL REQUIREMENT (`we:backlog/3645-*.md` "Done when" clause 2, and the parent epic's own
 * cross-cutting acceptance criterion). `deliverItem` is a BLOCKING arc: its one `provider.spawn` call is an
 * `execFileSync` budgeted at `DELIVERY_AGENT_SPAWN_TIMEOUT_MS` (60 minutes), and the gate + converge steps that
 * follow it block for minutes more. Every other launch kind's dispatch instead fires `claude --bg` and returns
 * in seconds.
 *
 * That difference is load-bearing, because of WHERE a dispatch runs. `we:skills-src/conveyor/runner.mjs`'s
 * `makeCliDispatchPass` shells `run.mjs dispatch-lane --num=<N>` with a SYNCHRONOUS `execFileSync`, once per
 * surfaced item, inside the resident runner's own tick. Calling `deliverItem` inline anywhere under that call
 * would put a 60-minute block inside the runner's tick loop: the singleton lease would go un-heartbeated, every
 * other item this tick would starve, and — the actual acceptance criterion — a `run.mjs restart-runner`
 * (`we:scripts/operations/restart-runner-io.mjs`, landed the same day) would SIGTERM the supervisor, take the
 * runner's whole process tree down with it, and kill a half-finished build mid-flight: a claimed item, a lane
 * lease held by nobody, an unreleased claim, and no PR.
 *
 * SO THE BLOCK MOVES OUT OF THE RUNNER. This script is that separate process. It is spawned `detached: true`
 * (Node calls `setsid`, making it a new session LEADER, so it is not in the runner's process group and a group
 * signal never reaches it), `.unref()`'d, with stdout/stderr redirected to a durable log file — the identical
 * shape `we:scripts/operations/restart-runner-io.mjs#startSupervisor` uses for exactly the same reason, and the
 * one `we:scripts/drain-push-at-close.mjs` documents in full. The dispatch sink therefore still returns in
 * milliseconds, exactly as the `claude --bg` path did, and the delivery outlives any restart of the thing that
 * started it.
 *
 * WHAT THE DISPATCHER KEEPS TO FIND IT AGAIN. The sink records `pid:<pid>` as the effect's durable handle (see
 * `deliverItemDetachedProvider`), which the run store persists exactly as it persisted a `claude --bg` short id.
 * After a restart the guard re-reads that record off disk and answers liveness with a pid probe
 * (`dispatch-lane-io.mjs#isDispatchHandleLive`) instead of a `claude agents` listing — so a restarted runner
 * still sees the in-flight delivery as ALIVE and refuses to double-dispatch it. Nothing about that read depends
 * on the process that wrote it still existing.
 *
 * IT PRINTS ITS RESULT AND EXITS. There is no polling and no callback: the durable evidence a delivery produces
 * is the PR it opens, the delivery report sidecar (`we:scripts/operations/delivery-report-store.mjs`) and this
 * process's own log file. The dispatch observer (`dispatch-lane-io.mjs#createDispatchObservers`) resolves the
 * effect off the merged PR exactly as it already did for the agent path — unchanged by this wiring.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deliverItem } from './deliver-item-wrapper.mjs';

/** Refused rather than defaulted: a delivery with no item, lane or session has nothing to acquire or claim. */
const REQUIRED_FLAGS = Object.freeze(['num', 'lane', 'session']);

/**
 * PURE. `--k=v` argv → the `launch` shape `deliverItem` takes, refusing a missing required flag by NAME.
 *
 * `attempt` and `scope` are optional: a first attempt has an empty attempt tag (`dispatch-lane.mjs#attemptTagFor`
 * returns `''`), and `scope` rides through to `lane-pool acquire --scope=` where an empty value is legal.
 *
 * @param {string[]} argv
 * @returns {{item: string, lane: string, scope: string, sessionSlug: string, attemptTag: string}}
 */
export function parseDeliverItemRunArgv(argv = []) {
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
      `deliver-item-run: missing required flag(s) ${missing.map((m) => `--${m}=`).join(', ')} — `
      + 'a delivery cannot acquire a lane or claim an item without them',
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
 * THE CLI, AS A FUNCTION — extracted from the `IS_CLI` block below for the same reason
 * `we:scripts/operations/review-dispatch.mjs#dispatchReviewCli` is: the argv parse, the exit-code mapping and
 * the failure text are all reachable from a test WITHOUT a subprocess and without a real `claude`.
 *
 * EXIT 1 MEANS THE DELIVERY THREW, never that its outcome was disappointing. `deliverItem` returns a `result`
 * string for every outcome it reasons about (`not-ready`, `blocked-mid-build`, `gate-red`, `gate-blocked`,
 * `PR #N`) and releases the lane and claim itself in each; those are exit 0, because the mechanism worked. Only
 * a wrapper-side throw — acquire refused, claim refused, the gate script itself crashed — is a non-zero exit,
 * and `deliverItem`'s own catch has already best-effort released what it held before it rethrows.
 *
 * @param {string[]} argv
 * @param {{deliver?: Function, write?: Function, writeErr?: Function}} [io]
 * @returns {Promise<{code: number, result: object|null}>}
 */
export async function runDeliverItemCli(argv = [], {
  deliver = deliverItem,
  write = (line) => process.stdout.write(line),
  writeErr = (line) => process.stderr.write(line),
} = {}) {
  let launch;
  try {
    launch = parseDeliverItemRunArgv(argv);
  } catch (e) {
    writeErr(`error: ${String(e?.message ?? e)}\n`);
    return { code: 1, result: null };
  }
  write(
    `deliver-item-run: starting delivery of #${launch.item} in lane ${launch.lane} `
    + `(session ${launch.sessionSlug}, attempt ${launch.attemptTag || '1'}) — pid ${process.pid}\n`,
  );
  try {
    const result = await deliver(launch);
    write(`deliver-item-run: #${launch.item} finished — ${result?.result ?? '(no result reported)'}\n`);
    return { code: 0, result };
  } catch (e) {
    writeErr(
      `deliver-item-run: #${launch.item} FAILED (lane and claim released best-effort by the wrapper): `
      + `${String(e?.message ?? e)}\n`,
    );
    return { code: 1, result: null };
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code } = await runDeliverItemCli(process.argv.slice(2));
  process.exitCode = code;
}
