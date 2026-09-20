#!/usr/bin/env node
/**
 * @file skills-src/conveyor/runner.mjs
 * @description The conveyor HEADLESS RUNNER (WE #2702, epic #2677(b), the DELEGATE half) — a SINGLETON-LOCKED,
 *   no-LLM runner that drives the mechanized tick core ({@link ../../scripts/conveyor/tick-core.mjs}, #2699)
 *   for the conveyor. It reads state and STEPS the tested state machine — it spends NO model context per tick
 *   (memory rule / #2701 clause 1): every guard, TTL, re-dispatch gate, watcher-arm, and idle-stop decision is
 *   the tick core's, applied deterministically; the runner is a THIN SHELL that threads the core's `nextState`
 *   into the next tick UNCHANGED and SURFACES the tick's decisions. It never re-derives a guard rule.
 *
 * WHAT #2701 SETTLES (the ratified mechanics-not-agent boundary, codified at
 *   [we:docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent]):
 *   1. The per-lane driver is a headless runner over the tested tick-core state machine — no per-tick model
 *      context. THIS file is that runner.
 *   2. NO per-lane conducting agent (Option B rejected) — so this is ONE singleton-locked runner, not an
 *      always-on LLM conductor per lane. The singleton right is held by {@link ./runner-lock.mjs}.
 *   3. A single supervisor is deferred (Option C) and genuine NOVELTY escalates to the main-session judgment
 *      layer — the runner never improvises a ruling. So the runner EMITS its dispatch/watch decisions
 *      ({@link tickSurface}) for the judgment layer to execute; it does not itself spawn LLM delivery agents.
 *
 * SCOPE (#2702, NOT #2703): this builds the runner MECHANISM — the singleton lock + the loop that steps the
 *   core, carries bookkeeping, runs the deterministic no-LLM passes (infra-blocked recovery §4b, lease-reaper
 *   §4c, session-reaper §4d, the reconcile-fix dispatch pass #3438), and surfaces the tick. It does NOT retire
 *   the main-session serial loop (that is #2703, blocked on this) and does NOT wire headless LLM agent-spawning
 *   (the CLI agent-runner backend,
 *   [#agent-runner-cli-backend]) — both belong to the retirement slice. The guard SEMANTICS are PRESERVED
 *   verbatim: they live in the tick core; the runner alters none of them.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from tick-core.mjs):
 *   • The PURE core ({@link carryForward}, {@link shouldStop}, {@link tickSurface}, {@link runLoop}) has NO
 *     fs / child_process / clock of its own — every effect (stepping a tick, dispatching, the mechanical
 *     passes, emitting, heartbeating the lease, sleeping) is INJECTED. `runLoop` is the runner's whole control
 *     flow, unit-tested (skills-src/conveyor/__tests__/runner.test.mjs) with fake effects — no git/network, no
 *     real lease, no `claude` process.
 *   • The IO SHELL (the `main()` CLI + the `cli*` effect builders, gated on the main-module check) shells
 *     `tick-core.mjs` (bookkeeping in on STDIN, `{ decisions, nextState }` out), calls `dispatch-lane` for each
 *     surfaced decision (#3383), runs the two deterministic passes, prints the surface, and heartbeats the
 *     real singleton lease.
 *
 * #3383 — WHAT CHANGED FROM "THREADS `nextState` FORWARD UNCHANGED". The runner still never re-derives a
 * guard — that invariant is intact. But it is no longer accurate to say it carries THIS tick's own
 * `nextState` forward byte-identical: `dispatchPass` (below) calls `dispatch-lane` once per surfaced
 * decision, and EACH call runs its OWN nested `tick-core` read, which updates `nextState` again as it goes.
 * Carrying a stale copy forward instead of the dispatch pass's own updated one would make the runner's
 * bookkeeping silently drift from what actually got dispatched: the same item would re-surface and get
 * RE-INVOKED every tick for its whole build lifetime, forever — not a second live agent (dispatch-lane's OWN
 * double-dispatch guard still catches that), but a wasted subprocess spawn every ~120s for as long as
 * anything is building. So `runLoop` now carries forward the DISPATCH PASS's `nextState` when one ran, not
 * the raw tick read's — still the tick core's own answer, just the latest one, and still nothing the runner
 * computed itself.
 *
 * #3416 — CORRECTION TO THE PARAGRAPH ABOVE'S ORIGINAL CLAIM. It used to say a newly-decided item's guard
 * "gets ADDED to `nextState`" only INSIDE dispatch-lane's own nested call, "a fact the runner's own top-level
 * tick read (made BEFORE any dispatching happens) cannot know." That is false: `tick-core.mjs`'s `planTick`
 * writes a guard the MOMENT it decides to surface a spawn candidate — in the SAME call that produces
 * `decisions.spawnBuilds`/`spawnPrepareScope`/etc, unconditionally, including the runner's own top-level
 * read. Forwarding that already-guarded `nextState` to `dispatch-lane` verbatim made every dispatch through
 * this pass suppress itself as "already in flight" — see `makeCliDispatchPass`'s own docblock below for the
 * fix (strip an item's own guard immediately before its call, restoring the pre-dispatch view for it alone).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadavg, freemem, totalmem, cpus, hostname } from 'node:os';
import { mkdirSync, writeFileSync, renameSync, appendFileSync, readFileSync } from 'node:fs';
import {
  RUNNER_LOCK_ROOT, runnerOwner,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned,
} from './runner-lock.mjs';
import { runGhSync } from '../../scripts/lib/gh-throttle.mjs';
import { selectStatusCandidates } from '../../scripts/conveyor/reconcile-core.mjs';
import { QUEUE_SCOPE_ENV, isQueueScopeEnabled, readScopedQueueIds } from '../../scripts/conveyor/queue-scope.mjs';
import { writeLineSync } from '../../scripts/lib/write-all-sync.mjs';
import { normNum } from '../../scripts/conveyor/queue-store.mjs';
import { writeDriverMode, driverModeFor } from '../../scripts/conveyor/driver-mode.mjs';
// #3383 — the delivery-telemetry recorder. The runner's own trace carries the host-level SATURATION metrics
// (admission decisions, lane-pool pressure, heavy-command queue wait) that belong to no single item, and that
// spans alone cannot express. Never throws by construction; see `telemetry-store.mjs`'s purity discipline.
import { createTelemetryRecorder } from '../../scripts/operations/telemetry-store.mjs';
// #3383 follow-on — per-process attribution, REDESIGNED (telemetry-granularity follow-on): capture EVERY
// process on the host from one `ps` snapshot per tick, keep the three FIXED `conveyor`/`drain`/
// `dispatched_agents` totals, and record every OTHER process that clears the storage floor as its own row —
// real identity, not a `vscode`/`chrome`/`other` bucket label. See that file's own header for the pure/IO
// split, the category-matching rules, and the real-data sizing math behind the storage floor;
// `readProcessSample` is the one IO edge, never throwing.
import {
  readProcessSample, buildProcessSnapshot, processSnapshotMetrics,
} from '../../scripts/operations/host-process-sample.mjs';
import { createActionStore } from '../../scripts/operations/action-store.mjs';
import { defaultGroundTruth } from '../../scripts/operations/action-ground-truth.mjs';
import { reconcileActions } from '../../scripts/operations/action-dispatch.mjs';
import { tryAcquireTickMutex, DRIVER_ID } from '../../scripts/operations/tick-mutex.mjs';
import { createTickBookkeeping } from '../../scripts/conveyor/tick-bookkeeping.mjs';
import { localDateString } from '../../scripts/lib/local-date.mjs';

/** The runner's tick interval — matches the SKILL's chained-sleep heartbeat (§2.5): ~120 s, just under the
 *  5-min prompt-cache window so a main-session loop's ticks stay cheap. The headless runner spends no model
 *  context, so the interval is only about how promptly it reacts to freed lanes / new PRs. */
export const DEFAULT_TICK_INTERVAL_MS = 120_000;

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/**
 * Build the NEXT tick's STDIN payload from THIS tick's output, threading `nextState` through UNCHANGED. This
 * is the thin-shell invariant made explicit: the runner carries the tick core's bookkeeping forward verbatim
 * — it never edits a guard, a TTL counter, or the watcher set (the core owns all of it). `signals` (e.g.
 * `returnedBuildNums`) are the ONLY thing the runner may add, and only from observed agent completions.
 * @returns {{ bookkeeping: object, signals: object }}
 */
export function carryForward(out, { signals = {} } = {}) {
  return { bookkeeping: (out && out.nextState) || {}, signals: signals || {} };
}

/**
 * Decide whether the loop STOPS after processing this tick. Two mechanical stop conditions, both from the core
 * (never re-derived): the core's `decisions.idleStop` (queue-empty AND no operator feedback for the window),
 * or a spent tick budget (`--max-ticks`, for a bounded/`--once` run). Pure — no clock.
 * @returns {{ stop: boolean, reason: string|null }}
 */
export function shouldStop(out, { tick = 0, maxTicks = Infinity } = {}) {
  if (out && out.decisions && out.decisions.idleStop) return { stop: true, reason: 'idle-stop' };
  if (Number.isFinite(maxTicks) && tick + 1 >= maxTicks) return { stop: true, reason: 'max-ticks' };
  return { stop: false, reason: null };
}

/**
 * The tick's SURFACE — exactly what the headless runner emits each tick. It spends no model context, so it
 * does NOT spawn the delivery / prepare / fix / CI-heal agents itself; it hands the core's already-filtered
 * decisions to the judgment layer to execute (#2701 clause 3), alongside the status line and per-tick notes.
 * A pure projection of `decisions` — it invents nothing and drops nothing.
 */
export function tickSurface(out) {
  const d = (out && out.decisions) || {};
  return {
    statusLine: d.statusLine || '',
    // #3398 — the structured tallies behind `statusLine` (tick-core's `computeTickCounts`), so a consumer
    // (the supervisor's alerting, once it captures this surface) can read `counts.queued` without re-parsing
    // the rendered line's text.
    counts: d.counts && typeof d.counts === 'object' ? d.counts : null,
    notes: Array.isArray(d.notes) ? d.notes : [],
    // #3383 — the DENIAL half of the dispatch decision, which this projection used to drop despite its own
    // describe-block promising it "drops nothing". Each entry is `{num, lane, by}` where `by` is the reason a
    // planned build was NOT dispatched (`'capacity-cap'` when the concurrent-lane ceiling was hit, or a guard
    // name). Without it the surface can say how many dispatches happened but never how many were REFUSED, and
    // the refusal rate is the system's primary saturation signal — the one `capToConcurrency` computes every
    // tick and nothing has ever recorded. See `emitTickMetrics`.
    suppressedBuilds: Array.isArray(d.suppressedBuilds) ? d.suppressedBuilds : [],
    dispatch: {
      builds: Array.isArray(d.spawnBuilds) ? d.spawnBuilds : [],
      prepareScope: Array.isArray(d.spawnPrepareScope) ? d.spawnPrepareScope : [],
      prepareDecision: Array.isArray(d.spawnPrepareDecision) ? d.spawnPrepareDecision : [],
      fixes: Array.isArray(d.spawnFixes) ? d.spawnFixes : [],
      ciHeals: Array.isArray(d.spawnCiHeals) ? d.spawnCiHeals : [],
    },
    armWatchers: Array.isArray(d.armWatchers) ? d.armWatchers : [],
    // 2026-09-14 (#3521/lane-2 incident) — the tick core's SELF-DIAGNOSED stall list (see `advanceHeldStall` /
    // `tick-core.mjs`): items held on the exact same reason for `stallTicks` consecutive ticks. Projected
    // through verbatim so both the human-readable `emit` text and the durable external status file (below)
    // carry it — a driver that is stuck now says so itself, instead of a human having to notice the absence
    // of progress across many raw ticks the way this incident required.
    stalled: Array.isArray(d.stalled) ? d.stalled : [],
    // 2026-09-14 (#3521 decision-trace v1) — the tick core's plain-language "why" for its OWN dispatch/skip/
    // stall decisions this tick (see `buildDecisionTrace` / `tick-core.mjs`). Projected through so the durable
    // trace sidecar (below) can log it without re-deriving anything.
    decisionTrace: Array.isArray(d.decisionTrace) ? d.decisionTrace : [],
  };
}

/**
 * The runner's WHOLE control flow, as a reducer over injected effects — so it is unit-testable with fakes and
 * carries no IO of its own. Each tick: step the core (`tickOnce`), emit the surface, run the deterministic
 * mechanical passes, THEN dispatch the surfaced decisions (`dispatchPass`) — this order, mechanical passes
 * before dispatch, not the reverse, since xpshzms (2026-09-07): `dispatchPass` is a sequential, blocking,
 * untimed spawn loop that can run long on a big backlog, and running it FIRST used to starve the (cheap,
 * bounded) mechanical passes of a timely turn — check stop, heartbeat the singleton lease, sleep, then carry
 * the DISPATCH PASS's `nextState` forward (see the file header, #3383, for why that is not the same as this
 * tick's own raw read). A lost lease (another process reclaimed a stale runner) STOPS the loop — the
 * singleton right to drive is gone.
 *
 * @param {object} effects
 * @param {(payload:object)=>Promise<object>|object} effects.tickOnce  step the tick core → `{ decisions, nextState }`
 * @param {(surface:object,ctx:object)=>any} [effects.emit]            surface the tick (status + notes + dispatch)
 * @param {(ctx:{tick:number,out:object})=>Promise<{nextState:object}>} [effects.dispatchPass]
 *   call `dispatch-lane` once per surfaced decision (#3383) and return the nextState after all of them —
 *   defaults to an identity pass-through (`out.nextState`, unchanged) so a caller with nothing to dispatch
 *   through pays no cost and needs no override.
 * @param {(ctx:{tick:number,out:object,heartbeat:Function})=>any} [effects.mechanicalPasses]  run the no-LLM
 *   passes (§4b infra, §4c/§4d reapers, #3105 verify-dispatch) — `heartbeat` (#3404) is the SAME lease-extend
 *   effect this loop calls after the tick, so a pass that itself outlasts the lease TTL can extend it mid-pass
 * @param {()=>boolean|Promise<boolean>} [effects.heartbeat]           extend the singleton lease; false ⇒ lost
 * @param {(ms:number)=>any} [effects.sleep]                           wait between ticks
 * @param {number} [effects.intervalMs]                                tick interval
 * @param {number} [effects.maxTicks]                                  bounded-run tick budget (Infinity = forever)
 * @param {object} [effects.initial]                                   first tick's STDIN payload (default `{}`)
 * @returns {Promise<{ ticks: number, stoppedReason: string, lastOut: object|null }>}
 */
/** #3383 — A shared tick is one critical section. No emit or pass runs for a losing driver. */
let tickSequence = 0;
export function createTickCoordination({ root, now = Date.now, actions = createActionStore({ root, now }),
  listAgents = defaultGroundTruth().listAgents, findEffect = defaultGroundTruth().findEffect,
  postconditionHolds = defaultGroundTruth().postconditionHolds, ...options } = {}) {
  return {
    acquire: (ctx) => tryAcquireTickMutex({ root, now, ...options, ...ctx }),
    ...createTickBookkeeping({ root, now, actions, ...options }),
    reconcileActions: () => reconcileActions({ actions, listAgents, findEffect, postconditionHolds, now }),
  };
}
export async function runTickOnce({ effects, coordination = null, driverId = DRIVER_ID, now = Date.now,
  payload = effects?.initial ?? {}, tick = 0 } = {}) {
  const tickId = `${driverId}#${++tickSequence}`;
  let acquired;
  try {
    acquired = coordination ? await coordination.acquire({ tickId, owner: { driverId, pid: process.pid, host: hostname() } })
      : { ok: true, handle: { heartbeat: () => true, release: () => true } };
  } catch (error) { return { ok: false, reason: 'coordination-unavailable', error: error.message }; }
  if (!acquired.ok) return { ok: false, reason: acquired.reason || 'busy', heldBy: acquired.heldBy };
  const mutex = acquired.handle;
  let lost = false;
  const heartbeat = async () => {
    if (lost) return false;
    const lockAlive = await mutex.heartbeat();
    const runnerAlive = await (effects.heartbeat?.() ?? true);
    lost = lockAlive !== true || runnerAlive !== true;
    return !lost;
  };
  try {
    const stored = coordination ? await coordination.loadBookkeeping() : { ok: true, fresh: true };
    if (!stored.ok) return { ok: false, reason: 'bookkeeping-unavailable', error: stored.error };
    const out = await effects.tickOnce(stored.fresh ? payload : { ...payload, bookkeeping: stored.bookkeeping });
    const ctx = { tick, driverId, tickId, at: new Date(now()).toISOString() };
    if (coordination && !await heartbeat()) return { ok: false, reason: 'lease-lost' };
    // Real status/trace publication is synchronous; fence it against stealing as one fs section.
    const publish = () => ({ ok: true, result: effects.emit?.(tickSurface(out), ctx) });
    const publication = mutex.runIfOwned ? mutex.runIfOwned(publish) : publish();
    if (!publication.ok) return { ok: false, reason: 'lease-lost' };
    await publication.result;
    let reconciliation = [];
    if (coordination) {
      try { reconciliation = await coordination.reconcileActions?.() ?? [];
        await effects.reportCoordination?.(reconciliation, ctx); }
      catch (error) { return { ok: false, reason: 'coordination-unavailable', error: error.message }; }
    }
    try { await effects.mechanicalPasses?.({ ...ctx, out, heartbeat }); } catch { /* best-effort mechanical pass */ }
    if (coordination && !await heartbeat()) return { ok: false, reason: 'lease-lost' };
    let dispatched = { nextState: out?.nextState || {} };
    try { dispatched = await effects.dispatchPass?.({ ...ctx, out, heartbeat }) ?? dispatched; } catch { /* actions retain uncertain dispatches */ }
    if (coordination) {
      if (!await heartbeat()) return { ok: false, reason: 'lease-lost' };
      const save = () => ({ ok: true, result: coordination.saveBookkeeping({ nextState: dispatched.nextState, driverId, tickId, now, guardMeta: stored.guardMeta }) });
      const saved = mutex.runIfOwned ? mutex.runIfOwned(save) : save();
      if (!saved.ok) return { ok: false, reason: 'lease-lost' };
      await saved.result;
    }
    return { ok: true, out, dispatched, tickId, driverId, reconciliation };
  } finally { await mutex.release(); }
}

export async function runLoop({
  tickOnce,
  emit = () => {},
  dispatchPass = async ({ out } = {}) => ({ nextState: (out && out.nextState) || {} }),
  mechanicalPasses = () => {},
  heartbeat = () => true,
  sleep = () => {},
  intervalMs = DEFAULT_TICK_INTERVAL_MS,
  maxTicks = Infinity,
  initial = {},
  coordination = null,
  driverId = DRIVER_ID,
  now = Date.now,
  reportCoordination,
} = {}) {
  if (typeof tickOnce !== 'function') throw new TypeError('runLoop requires a tickOnce effect');
  let payload = initial || {};
  let tick = 0;
  let stoppedReason = 'unknown';
  let lastOut = null;
  // The loop stops on the core's idle-stop, a spent `maxTicks` budget, or a lost lease; a real run passes
  // `maxTicks: Infinity` and relies on idle / lease-loss to end it (a test always bounds it via `maxTicks`).
  for (;;) {
    const result = await runTickOnce({ effects: { tickOnce, emit, dispatchPass, mechanicalPasses, heartbeat, reportCoordination },
      coordination, driverId, now, payload, tick });
    if (!result.ok) {
      await reportCoordination?.([result], { driverId, tick });
      if (result.reason !== 'busy' || tick + 1 >= maxTicks) { stoppedReason = result.reason; break; }
      if (!await heartbeat()) { stoppedReason = 'lease-lost'; break; }
      await sleep(intervalMs); tick += 1; continue;
    }
    const { out, dispatched } = result;
    lastOut = out;

    const stop = shouldStop(out, { tick, maxTicks });
    if (stop.stop) { stoppedReason = stop.reason; break; }

    // Extend the singleton lease BEFORE sleeping; if it was reclaimed away (this runner went stale), STOP — we
    // no longer hold the sole-driver right, and continuing would risk the double-dispatch the lock prevents.
    const alive = await heartbeat();
    if (!alive) { stoppedReason = 'lease-lost'; break; }

    await sleep(intervalMs);
    // No `signals` folded in: `dispatchPass` starts agents but does not WATCH them run to completion, so there
    // is still no `returnedBuildNums` to inject here — that remains a later slice. `nextState` DOES come from
    // the dispatch pass now, not the raw tick read — see the file header (#3383) for why carrying the stale
    // one forward would silently re-surface an already-dispatched item every tick.
    payload = carryForward({ ...out, nextState: dispatched.nextState }, {});
    tick += 1;
  }
  return { ticks: tick + 1, stoppedReason, lastOut };
}

// ── IO SHELL (runs only as a CLI — owns all child_process / real lease; keeps the pure core effect-free) ────

/** Build the real `tickOnce` effect: shell `tick-core.mjs`, pipe the bookkeeping payload in on STDIN, parse
 *  `{ decisions, nextState }` off STDOUT. This is the SAME core the main-session SKILL loop shells (§2b) — the
 *  runner and the SKILL can never disagree on a guard, because there is exactly ONE core. */
function makeCliTickOnce({ tickCorePath, repo = null }) {
  return async (payload) => {
    const { execFileSync } = await import('node:child_process');
    const args = [tickCorePath];
    if (typeof repo === 'string' && repo) args.push(`--repo=${repo}`);
    const out = execFileSync('node', args, {
      input: JSON.stringify(payload || {}),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out);
  };
}

/** #3404 — how often the verify-dispatch pass's own long run heartbeats the singleton lease WHILE it is still
 *  running, not only after it returns. Well under the 15-min lease TTL (`RUNNER_LEASE_MINUTES`,
 *  {@link ./runner-lock.mjs}) and well under the pass's own typical 150-350s runtime, so a normal run
 *  heartbeats at least once or twice mid-pass, not zero times. */
const MECHANICAL_PASS_HEARTBEAT_MS = 60_000;

/** Build the real `mechanicalPasses` effect: the deterministic, no-LLM passes the SKILL runs each tick —
 *  the infra-blocked recovery pass (§4b), the lease-reaper (§4c), the session-reaper (§4d, WE #3435 — stops
 *  a `claude agents` background session once ITS OWN process reports `done`/`failed`, a wholly separate
 *  resource from a lane lease), the reconcile-fix dispatch pass (#3438 — dispatches the fix agent
 *  `we:scripts/conveyor/reconcile-pass.mjs` decides is owed for a bounced PR with nothing live working it, a
 *  genuinely different population from `decisions.spawnFixes`'s own tick-core-launched-PRs-only scope; see that
 *  file's own header for the full reasoning), the branch-drift sweep (#3464 — `we:scripts/conveyor/
 *  branch-drift.mjs sweep`: reports the long-lived dispatched-work branch's live divergence/conflict state to
 *  its durable git-note report, the SAME "piggyback on a pass this headless runner already ticks" shape #3449
 *  used for lane-pool lease reconciliation, so drift is caught without a human or interactive session ever
 *  noticing it by hand), the parked-PR conflict watch (#xw0odtv — `we:scripts/conveyor/
 *  parked-pr-conflict-watch.mjs sweep`: labels + one-time-comments any review-parked PR that has drifted into a
 *  real merge conflict against `main`, catching exactly the axis branch-drift's single-branch watch and #2824's
 *  BEHIND-only freshness gate both leave uncovered), the general PR-landing-progress watch (we:3550 —
 *  `we:scripts/conveyor/parked-pr-progress-watch.mjs sweep`: flags a review-parked PR sitting past a
 *  configurable threshold with no independent review ever dispatched for it — the neglect axis neither
 *  sibling watch above catches), the review-reconcile pass (epic #3383, x5v8yy9 — reads
 *  `conveyor/reconcile-pass.mjs`'s own decision and dispatches `operations/review-dispatch.mjs` for every PR it
 *  names, plus the purely-informative `review-round-tag.mjs`/`review-status-tag.mjs` labels — the review step
 *  is now actually mechanized, not merely planned; see {@link selectStatusCandidates} for which PRs the status
 *  refresh covers), (#3421) the blocking-hiccup sink, and the CI queue-wait watch (#3574 — `we:scripts/
 *  conveyor/ci-queue-watch.mjs sweep`: samples `gh run list`'s started-minus-created wait time and appends it
 *  to a durable sidecar history, the SAME "piggyback on a pass this headless runner already ticks" shape
 *  branch-drift above uses, so a genuine Actions run-queue regression becomes a visible trend instead of
 *  invisible; purely informative — no dispatch gate reads its verdict), and the verify-dispatch pass
 *  (#3105: picks up a `request`-stamped gate marker and runs it AS the runner's own process, unbound by an
 *  agent's 120s foreground window). All eleven are best-effort: a failure is
 *  swallowed (logged to stderr) and never gates the tick. Never a local merge — the drain stays the sole writer
 *  to `main`.
 *
 *  THE REVIEW-RECONCILE PASS needs no session-ephemeral bookkeeping of its own, unlike the tick's own
 *  build/prepare/fix/ci-heal guards: `reconcile-pass.mjs` reads real ground truth (findings on the PR, a live
 *  `claude agents` session bound to it via cwd/HEAD sha) every time it runs, so it can just be re-run every
 *  tick. The upstream liveness read suppresses known live work; #3383's durable resource action record
 *  also refuses a dispatch when that read lags. The shared tick mutex serializes these passes across drivers.
 *
 *  THE HICCUP SINK is the ONLY one of the eleven that reads `out` (this tick's already-computed
 *  `decisions.suppressedBuilds` — the #3416 guard-suppression shape): it is the mechanical half of #3421's
 *  auto-file-a-fix story, filing a gated `blocking` learnings entry the moment a live guard holds a
 *  dispatch, rather than waiting for a human `/note`. It files NOTHING for the #3412 free-form-response
 *  shape — this runner spawns no LLM agents (#2701 clause 3) and so never observes an agent's return; that
 *  classification is the judgment layer's own job (skills-src/conveyor/SKILL.md), via the same
 *  hiccup-sink.mjs `fileHiccup`.
 *
 *  THE REVIEW-RECONCILE PASS needs no session-ephemeral bookkeeping of its own, unlike the tick's own
 *  build/prepare/fix/ci-heal guards: `reconcile-pass.mjs` reads real ground truth (findings on the PR, a live
 *  `claude agents` session bound to it via cwd/HEAD sha) every time it runs, so it can just be re-run every
 *  tick. The upstream liveness read and #3383's durable resource action record both guard dispatch.
 *  Firing its per-PR `review-dispatch.mjs` calls
 *  SEQUENTIALLY mirrors `makeCliDispatchPass`'s own reasoning —
 *  parallel runs have no benefit and this keeps one bad dispatch's blast radius the same as every other pass
 *  here. #xu2pp2m — each call is now a BLOCKING mechanical review rather than a fork-and-return `claude --bg`
 *  spawn, so this pass (like verify-dispatch) heartbeats the lease while it runs.
 *
 *  VERIFY-DISPATCH (#3105) can legitimately run for as long as the gate itself takes (150–350s, sometimes
 *  longer): it is a full `verify-lane.mjs` run, not a quick bookkeeping sweep. That is fine here — this tick
 *  simply takes longer; nothing about the runner's own loop is bound by a per-turn window the way an
 *  interactive agent's Bash call is. #3404 — it is run through {@link runQuietHeartbeating}: its runtime can outlast the singleton
 *  lease's TTL if nothing heartbeats DURING it — a mid-pass heartbeat closes the exact stale-lease-mid-run
 *  window `#2453` already fixed for the plateau-app drain daemon's whole-process lease. #3383 extends this
 *  heartbeating wrapper to the other passes too: the shared tick mutex has a shorter lease, and every pass
 *  must renew both leases while it runs.
 */

/**
 *  QUEUE SCOPING — WHICH OF THESE PASSES IS REPO-WIDE, AND WHAT NOW NARROWS THEM (epic #3383, default OFF).
 *
 *  THE LIVE BUG. A scratch checkout was given its own `.conveyor/queue.json` (5 items) and a kind-scoped
 *  `.conveyor/dispatch-pause.json` holding every spawn kind but `build`, so ONE bounded `--once` tick could
 *  touch those 5 items and nothing else. The kind scoping worked. The MECHANICAL PASSES did not respect it at
 *  all — they never read the queue — and the same tick reviewed two unrelated `review:pending` PRs found by a
 *  repo-wide `gh pr list`, which the (separate, resident) drain then landed.
 *
 *  THE PAUSE LEVER WAS NOT THE FIX, AND ITS OWN REASONING IS LEFT INTACT. `dispatch-pause.mjs`'s header says
 *  `review-dispatch` is deliberately outside `PAUSABLE_KINDS`. That is right: pausing is an ADMISSION gate on
 *  NEW work, while these passes CLEAR work already open — gating them by default would strand every in-flight
 *  PR the moment an operator paused new dispatch. The wrong verb was being reached for. The right one is
 *  SCOPING: the passes keep running, on a narrowed candidate set.
 *
 *  WHERE EACH PASS GETS ITS CANDIDATES, and which ones therefore needed the filter:
 *    • `reconcile-pass.mjs` → `gh pr list --state open` REPO-WIDE. **Scoped.** The single highest-leverage
 *      point: this one plan drives `review-dispatch.mjs`, both tag scripts, AND `reconcile-fix-dispatch.mjs`
 *      (which calls `runReconcilePass` directly), so filtering the read scopes all four effects at once.
 *    • `parked-pr-conflict-watch.mjs` / `duplicate-pr-watch.mjs` / `parked-pr-progress-watch.mjs` → their own
 *      REPO-WIDE `gh pr list --state open`. **Scoped**, each at the one point the listing enters the sweep.
 *    • `verify-dispatch.mjs` → NOT `gh` at all: the HOST-WIDE lane pool. **Scoped** on lane branch name — a
 *      different leak axis (filesystem, not GitHub) but the same "an isolated instance is not isolated" bug.
 *    • `review-round-tag.mjs` / `review-status-tag.mjs` → already derived entirely from the reconcile plan, so
 *      they inherit its scoping and needed no change of their own.
 *    • `infra-blocked.mjs` / `lease-reaper.mjs` / `session-reaper.mjs` / `branch-drift.mjs` /
 *      `ci-queue-watch.mjs` / `lane-pool-health-watch.mjs` / the hiccup sink → NOT scoped, deliberately. None
 *      of them mutates a pull request: they read local sidecar state, this tick's own decisions, one named
 *      branch, `gh run list` timings, or host lane/lease/session hygiene. Scoping host-hygiene passes would
 *      trade the bug being fixed for a worse one (a scoped instance that stops reaping its own dead leases).
 *
 *  DEFAULT OFF is load-bearing: with no `.conveyor/queue-scope.json` and no `--scope-to-queue`, every filter
 *  above is the identity function and a production checkout behaves exactly as it did. See
 *  {@link ../../scripts/conveyor/queue-scope.mjs}. */

/** Cap on {@link summarizeMechanicalPassError}'s output — generous for a real diagnostic, still bounded so one
 *  runaway stack trace can't flood `runner.log`. */
export const MECHANICAL_PASS_ERROR_LOG_CHARS = 800;

/**
 * The text `runQuiet` (below) logs for a failed mechanical pass — found live 2026-09-04 investigating a
 * `session-reaper.mjs` failure: `execFileSync`'s thrown error's OWN `.message` already carries the child's full
 * captured stderr, appended by Node itself after the leading `Command failed: <cmd>` line — but the previous
 * `String(e.message || e).split('\n')[0]` kept ONLY that first line and threw away everything after it,
 * discarding the real error on EVERY mechanical-pass failure this runner has ever logged, not just that one.
 * The one line `runner.log` actually recorded that night — `⚠ mechanical pass conveyor/session-reaper.mjs
 * failed (non-fatal): Command failed: node .../session-reaper.mjs` — carries zero information about WHY;
 * reproducing the exact same truncation against a real `execFileSync` throw (a child that `console.error`s
 * detail then exits 1) confirmed this is the whole gap, byte for byte. Collapses whitespace/newlines so a
 * multi-line stderr still logs as ONE `runner.log` line (grep-able, matching the file's existing one-line-per-
 * event convention), bounded to `maxChars` rather than left unbounded.
 * @param {unknown} e
 * @param {number} [maxChars]
 * @returns {string}
 */
export function summarizeMechanicalPassError(e, maxChars = MECHANICAL_PASS_ERROR_LOG_CHARS) {
  const full = String((e && e.message) || e);
  return full.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

export function makeCliMechanicalPasses({ scriptsDir, repo = null, hiccupSession } = {}) {
  return async ({ out, heartbeat = () => true } = {}) => {
    const { execFileSync } = await import('node:child_process');
    // `repo` here is a GitHub `owner/repo` SLUG (this runner's own `--repo` flag, threaded through for the
    // `gh`-calling passes below). `runQuiet` forwards it as `--repo=<repo>` to every pass by default, which is
    // harmless for passes that either consume it as that same slug (`ci-queue-watch.mjs`,
    // `parked-pr-conflict-watch.mjs`, `duplicate-pr-watch.mjs`, `parked-pr-progress-watch.mjs`,
    // `reconcile-pass.mjs`, `reconcile-fix-dispatch.mjs`) or silently ignore an unrecognized flag
    // (`branch-drift.mjs`, `session-reaper.mjs`, `lease-reaper.mjs`).
    //
    // `conveyor/lane-pool-health-watch.mjs` is the one pass where this is NOT harmless — live incident, found
    // debugging a recurring "could not determine an origin URL" failure every tick. That pass's OWN `--repo`
    // flag (threaded to `lane-pool.mjs status --json --repo=<...>`) means a CHECKOUT PATH
    // (`lane-pool.mjs`'s `resolveRepo()` resolves it with `resolve(flags.repo || cwd())` and derives the origin
    // URL from `git remote get-url origin` run THERE) — a completely different contract from the GH slug this
    // runner threads everywhere else. Forwarding the slug here made `lane-pool.mjs` `resolve()` a nonexistent
    // path (`<cwd>/<owner>/<repo>`, e.g. `.../wev-scratch-dispatcher-9/chalbert/web-everything`), whose `git`
    // calls silently no-op to null (`tryGit` swallows the "no such directory" failure) and the resolver reports
    // the whole thing as "no origin", not "bad path" — hence `resolveRepo` failing loud with `could not
    // determine an origin URL`, every tick, forever (this pass never needs `--repo` at all: `defaultListLaneStatus`
    // already reads `root`'s OWN pool via `cwd`, no selector required). So this one pass opts OUT of the
    // default forward entirely — seen live in `wev-scratch-dispatcher-9/run.log`.
    // #3383: even the fix-reconcile subprocess can outlast the tick lease. Keep the event loop
    // available so every mechanical child renews both leases throughout its execution.
    const runQuiet = (relPath, extraArgs = [], { forwardRepo = true } = {}) => runQuietHeartbeating(
      join(scriptsDir, relPath), { args: extraArgs, repo: forwardRepo ? repo : null, heartbeat, label: relPath },
    );
    // epic #3383 — FIRST, before anything that might refuse on a stale `main`. `we:scripts/operations/
    // review-dispatch.mjs#assertMainNotStale` (called by BOTH `reconcile-fix-dispatch.mjs` just below and the
    // review-dispatch reconcile step later in this same pass) throws whenever this checkout's LOCAL `main` ref
    // is behind `origin/main` by even one commit — and nothing else in this checkout's own operating loop ever
    // touches `main` (its real work happens on `lane/mechanical-dispatcher`). Found live 2026-09-14: a real
    // driver checkout's local `main` sat 161 commits / 33+ hours stale, so EVERY fix/review dispatch this pass
    // tried silently refused, every tick, with only a swallowed one-line stderr warning to show for it — a real,
    // capacity-available, correctly-computed dispatch plan that never once fired. `main-ref-sync.mjs` is a plain
    // `git fetch origin main:main` (never touches the working tree; a no-op if `main` happens to be the checked-
    // out branch here) — it does not touch or weaken `assertMainNotStale` itself, only keeps the ground truth it
    // checks from going stale in the first place. `forwardRepo: false` — this pass takes `--repo-dir=`, a
    // filesystem path, not the GH `owner/repo` slug `runQuiet` forwards by default (same reasoning
    // `lane-pool-health-watch.mjs` below states for its own opt-out).
    await runQuiet('conveyor/main-ref-sync.mjs', [], { forwardRepo: false });
    // epic #3383 — THE GENERALIZED POC-BRANCH ↔ TARGET SYNC. `main-ref-sync.mjs` just above keeps this
    // checkout's own LOCAL `main` ref fresh; this pass is the OTHER half — it keeps every REGISTERED POC
    // branch (`we:scripts/lib/poc-branches.json`) mechanically merged with its own graduation target, gated
    // per branch by the `autoSync` knob (`we:scripts/lib/poc-branches.mjs#resolveAutoSyncEnabled` — off by
    // default, on today for `lane/mechanical-dispatcher`). Bare git plumbing only (fetch → `merge-tree`
    // conflict probe → `commit-tree` + a never-forced push) — no `git checkout`, so it is safe to run from
    // this driver's own checkout regardless of which branch that checkout currently has checked out. A clean
    // divergence merges automatically; a real conflict is bounded-retried then durably escalated, exactly
    // `conveyor/branch-sync.mjs`'s own discipline (reused here, not reimplemented) — never force-merged
    // through. `forwardRepo: false` — like `main-ref-sync.mjs`, this pass takes no GH-slug flag at all.
    await runQuiet('conveyor/poc-branch-sync.mjs', [], { forwardRepo: false });
    await runQuiet('conveyor/infra-blocked.mjs', ['retry']);
    await runQuiet('conveyor/lease-reaper.mjs');
    await runQuiet('conveyor/session-reaper.mjs'); // §4d — WE #3435
    await runQuiet('conveyor/reconcile-fix-dispatch.mjs'); // #3438
    // #3464 — sweeps its OWN default watched branch (`lane/mechanical-dispatcher` vs `main`), env/flag
    // overridable. `runQuiet` still appends `--repo=<repo>` when this runner was given one — harmless, since
    // `branch-drift.mjs`'s CLI parses and simply ignores any flag it doesn't itself read.
    await runQuiet('conveyor/branch-drift.mjs', ['sweep']);
    // #3574 — samples `gh run list`'s started-minus-created wait time and appends it to the durable sidecar
    // history, so a genuine Actions run-queue regression becomes a visible trend instead of invisible (this
    // repo's own investigation found nothing tracking it over time). Purely informative — no dispatch gate
    // reads its verdict, unlike branch-drift's `blocked` above.
    await runQuiet('conveyor/ci-queue-watch.mjs', ['sweep']);
    // #xw0odtv — sweeps every OPEN PR for a review-parked (review:human/pending/uncleared-changes) hold that
    // has drifted into a REAL merge conflict (mergeable === CONFLICTING) against main, applying an informative
    // `merge-status:conflicting` label + a one-time comment (self-clearing once the conflict resolves). Distinct
    // from #2824 (BEHIND-only, not yet built) and from branch-drift.mjs (one named branch, not the open-PR
    // population) — see that file's own header for the full gap this closes.
    await runQuiet('conveyor/parked-pr-conflict-watch.mjs', ['sweep']);
    // #3568 — reaps known-safe scratch litter (`.commit-msg.txt`, `.pr-body.md`, …) from every UNLEASED lane
    // whose entire dirty state matches only that allowlist, reusing the SAME `we:scripts/lib/lane-litter.mjs`
    // core `we:scripts/lane-pool.mjs#cmdRelease` uses at release time — reclaims litter that predates that fix
    // or accumulated through any path other than a normal release. See that file's own header for the full
    // 2026-09-07 "0 of 48 lanes acquirable" incident this pass exists to prevent from recurring.
    await runQuiet('conveyor/lane-pool-health-watch.mjs', [], { forwardRepo: false });
    // Epic #3383 — MECHANIZE THE REVIEW STEP (x5v8yy9). `conveyor/reconcile-pass.mjs` (#3296) already decides
    // WHEN an open PR is owed an independent review — it reads real ground truth (findings on the PR, a live
    // `claude agents` session bound to it via cwd/HEAD sha) every time it runs, so unlike the tick's own
    // build/prepare/fix/ci-heal guards it needs NO session-ephemeral bookkeeping of its own; it can just be
    // re-run every tick, safely, the same way `infra-blocked.mjs`/`lease-reaper.mjs` already are.
    // `operations/review-dispatch.mjs` (#3279) existed and worked standalone, but nothing called it
    // automatically — this closes that gap.
    //
    // DOUBLE-DISPATCH IS ALREADY GUARDED, UPSTREAM, NOT HERE. `reconcile-core.mjs`'s own liveness read binds a
    // live session to a PR (cwd → HEAD sha) and refuses (`live-process`) BEFORE the `review` dispatch decision
    // is ever reached — so a review already in flight for a PR simply does not appear in next tick's plan.
    //
    // SEQUENTIAL, mirroring `makeCliDispatchPass`'s own reasoning even though nothing here shares guard state:
    // firing N reviews at once has no benefit and this keeps one bad dispatch's blast radius the same as every
    // other pass here (best-effort — a single PR's dispatch failure never stops the rest of the tick, or the
    // tick itself).
    //
    // #xu2pp2m — EACH ONE NOW BLOCKS UNTIL THE REVIEW HAS A VERDICT. `review-dispatch.mjs` no longer forks a
    // `claude --bg` agent to type three commands out of a brief; it runs those three commands itself
    // (`review-dispatch-wrapper.mjs`). So a tick with reviews owed is minutes longer than one without — which
    // is fine here, exactly as it is for verify-dispatch (#3105/#3404), PROVIDED the singleton lease is
    // heartbeated mid-pass. It is: see the `runQuietHeartbeating` call in the loop below.
    let plan = null;
    try {
      const reconcileArgs = [join(scriptsDir, 'conveyor', 'reconcile-pass.mjs'), '--json'];
      if (typeof repo === 'string' && repo) reconcileArgs.push(`--repo=${repo}`);
      const reconcileOut = execFileSync('node', reconcileArgs, {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
      });
      plan = JSON.parse(reconcileOut);
    } catch (e) {
      process.stderr.write(`⚠ mechanical pass conveyor/reconcile-pass.mjs failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
    }
    // #x5v8yy9 review finding — kept as its OWN try/catch, separate from the `reconcile-pass.mjs` call above:
    // this block's own failures (the `gh repo view` slug resolution, or a per-PR dispatch/tag call) used to
    // share that call's catch and log as "mechanical pass conveyor/reconcile-pass.mjs failed" even though
    // `reconcile-pass.mjs` itself had already succeeded — misattributing the failing step to an operator
    // reading `runner.log`.
    try {
      if (plan) {
        const reviewsOwed = (Array.isArray(plan.dispatch) ? plan.dispatch : []).filter((d) => d && d.kind === 'review');
        // x5v8yy9 — every PR this pass has an OPINION about, informatively tagged, EXCLUDING only `nothing-owed`
        // (reviewed/queued/landed, or a genuinely signal-free PR). `owed-elsewhere` is NOT excluded — it covers
        // real conveyor PRs stuck `needs-human`/`ci-red`/`conflicted`, not just unrelated ones (see
        // `selectStatusCandidates`'s own docblock for the PR #1920 staleness incident this fixes).
        const statusCandidates = selectStatusCandidates(reviewsOwed, plan.refusals);
        if (reviewsOwed.length || statusCandidates.length) {
          // `review-dispatch.mjs` / the tag scripts REQUIRE a real `owner/repo` slug (unlike `reconcile-pass.mjs`,
          // which lets `gh` resolve it from cwd) — resolve it once, lazily, only when there is actually work to
          // do, so the common empty-plan tick never pays for an extra `gh` call.
          // Throttled (#3621) — `we:scripts/lib/gh-throttle.mjs#runGhSync`, a byte-for-byte transparent
          // `execFileSync('gh', args, opts)` replacement gated through the shared `gh`-call concurrency
          // semaphore with rate-limit backoff. This is the runner's own direct `gh` call (not a script it
          // shells), paid only when review work is actually owed this tick.
          const repoSlug = typeof repo === 'string' && repo
            ? repo
            : runGhSync(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
              encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            }).trim();
          for (const d of reviewsOwed) {
            // #x5v8yy9 review finding — `dispatched` gates the round-tag call below. Before this fix,
            // `review-round-tag.mjs` ran unconditionally after `review-dispatch.mjs`, even when the dispatch
            // attempt itself threw and no session was ever spawned — so `review-round:<N>` kept advancing every
            // tick regardless of whether a review actually happened, misleading anyone reading the label.
            // #xu2pp2m — HEARTBEATED, not a bare `execFileSync`, because `review-dispatch.mjs` is now
            // MECHANICAL and therefore BLOCKING. It used to return the instant `claude --bg` forked; it now
            // returns when the review has an actual verdict, which is minutes. That is the SAME shape #3404
            // already solved for `verify-dispatch.mjs`: a pass whose runtime can approach the 15-minute
            // singleton lease TTL must heartbeat the lease WHILE it runs, and `execFileSync` structurally
            // cannot (it blocks the event loop until the child exits, so no timer can fire). Without this the
            // runner would lose its own lease mid-review and stop.
            //
            // `dispatched` now means MORE than it did, and that is deliberate — see `review-dispatch.mjs`'s
            // header. Exit 0 from the mechanical path proves a review RAN and reached a verdict; a
            // `blocked-on-infra` classification (no free lane, a crashed loop) exits non-zero. So the
            // `review-round:<N>` label below finally advances on rounds that happened rather than on sessions
            // that were forked, which is what #x5v8yy9's own comment always claimed for it.
            const dispatched = await runQuietHeartbeating(
              join(scriptsDir, 'operations', 'review-dispatch.mjs'),
              {
                repo: null, // the slug is passed explicitly below; `runQuietHeartbeating`'s own `--repo` append would duplicate it
                args: [`--pr=${d.prNumber}`, `--repo=${repoSlug}`],
                heartbeat,
                label: `review-dispatch --pr=${d.prNumber}`,
              },
            );
            if (!dispatched || !await heartbeat()) continue; // no review actually ran — never advance the round label for this PR
            // PURELY INFORMATIVE (`review-round-tag.mjs`) — a `review-round:<N>` label so a human scanning the
            // PR list can see how many rounds a PR has been through with no click-through. `d.attempts` is
            // `reconcile-pass.mjs`'s own durable re-arm count for THIS PR — the round about to run is one past
            // that. Best-effort: a failed tag write never blocks a review from actually being dispatched.
            try {
              execFileSync('node', [join(scriptsDir, 'conveyor', 'review-round-tag.mjs'), String(d.prNumber), `--repo=${repoSlug}`, `--round=${(d.attempts ?? 0) + 1}`],
                { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
            } catch (e) {
              process.stderr.write(`⚠ mechanical pass review-round-tag --pr=${d.prNumber} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
            }
          }
          // PURELY INFORMATIVE (`review-status-tag.mjs`) — "is a reviewer or a fixer actually working this PR
          // right now, or is a live session stuck". Covers PRs NOT being freshly dispatched this tick too (an
          // already-live session, or one that just finished and needs its stale label cleared).
          for (const c of statusCandidates) {
            try {
              execFileSync('node', [join(scriptsDir, 'conveyor', 'review-status-tag.mjs'), String(c.prNumber), `--repo=${repoSlug}`],
                { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
            } catch (e) {
              process.stderr.write(`⚠ mechanical pass review-status-tag --pr=${c.prNumber} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
            }
          }
        }
        // #xu2pp2m — A DUPLICATED, ALWAYS-THROWING COPY OF THE TWO LOOPS ABOVE WAS DELETED HERE. It was a
        // merge artifact (the branch's own cross-PR reconcile commit, `c014ef4`, landed the round-tag and
        // status-tag loops twice): the second `review-round-tag.mjs` call sat OUTSIDE
        // `for (const d of reviewsOwed)` and still referenced `d`, whose `let`-scope ends with that loop — so
        // reaching it ALWAYS threw `ReferenceError: d is not defined`, every tick this branch ran.
        //
        // WHAT IT ACTUALLY COST, stated no wider than it was: the two loops above it had already done the real
        // work, and the copy below the throw was redundant with the status sweep that had just run — so no
        // label went unwritten. What was lost was the LOG: every such tick ended in
        // `⚠ mechanical pass review-reconcile dispatch failed (non-fatal): d is not defined`, which reads as
        // "the review pass failed" when the review pass had in fact succeeded. An operator debugging a real
        // dispatch failure was looking at a permanent false positive. Found while wiring the mechanical
        // dispatch through here, not looked for.
      }
    } catch (e) {
      process.stderr.write(`⚠ mechanical pass review-reconcile dispatch failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
    }
    // #xs19sz9 — sweeps every OPEN PR for TWO OR MORE PRs delivering the SAME backlog item number (reusing
    // `we:scripts/lib/open-pr-items.mjs#deliveredItemNumsFromPr`, the readiness ranker's own "which item does
    // this PR deliver" extractor) and posts a `review:changes` finding on each one via
    // `we:scripts/conveyor/reconcile-finding.mjs` — never picking a keeper (that needs a real diff read, proven
    // by the 2026-09-05 incident this pass was born from). Dedup: a PR already carrying `review:changes` is
    // skipped (the label's own presence is the durable marker, same idea as the conflict-watch line above,
    // reusing an existing label instead of minting a new one). See that file's own header for the full design.
    await runQuiet('conveyor/duplicate-pr-watch.mjs', ['sweep']);
    // we:3550 — sweeps every OPEN, review-parked PR (review:pending/review:changes/review:human) for the
    // general neglect axis neither sibling watch above catches: no `review-<pr>`/`fix-<pr>` agent session has
    // EVER been dispatched for it, and it has sat past a configurable threshold (default 24h,
    // WE_PR_NEGLECT_THRESHOLD_HOURS), read off GitHub's own issue-events label timeline — no new state store.
    // Posts a `review:changes` finding via reconcile-finding.mjs, same as the line above. Dedup: a PR already
    // `review:changes` is skipped (that re-check is the separate follow-on we:3596, out of scope here). See
    // that file's own header for the full design, ratified in we:3549.
    await runQuiet('conveyor/parked-pr-progress-watch.mjs', ['sweep']);
    // #3105/#3404 — unlike the passes above, this one can legitimately run for as long as the gate itself
    // takes (150–350s, sometimes longer): it is a full `verify-lane.mjs` run, not a quick bookkeeping sweep.
    // That is fine here — this tick simply takes longer — but the lease must be heartbeated WHILE it runs, not
    // only once the whole tick returns.
    await runQuietHeartbeating(join(scriptsDir, 'conveyor', 'verify-dispatch.mjs'),
      { repo, heartbeat, label: 'conveyor/verify-dispatch.mjs' });
    try {
      // Literal relative specifiers (not scriptsDir-joined) — a computed dynamic-import argument trips
      // Vite/Rollup's SSR import analysis (used to transform this file under vitest); a string literal is
      // what every bundler's static import graph expects. runner.mjs lives in skills-src/conveyor/, these
      // two in scripts/conveyor/ — the SAME relative hop TICK_CORE itself resolves via SCRIPTS_DIR above.
      const { classifySuppressedBuilds } = await import('../../scripts/conveyor/hiccup-classify.mjs');
      const { fileHiccups } = await import('../../scripts/conveyor/hiccup-sink.mjs');
      const suppressed = out && out.decisions && out.decisions.suppressedBuilds;
      const hiccups = classifySuppressedBuilds(suppressed);
      if (hiccups.length) fileHiccups(hiccups, { session: hiccupSession });
    } catch (e) {
      process.stderr.write(`⚠ mechanical pass hiccup-sink failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
    }
  };
}

/**
 * Run one script async (never blocking the event loop the way `execFileSync` does), heartbeating the lease
 * every {@link MECHANICAL_PASS_HEARTBEAT_MS} while it is still running, and resolving once it exits — best-
 * effort like `runQuiet` (a non-zero exit or spawn error is swallowed, logged to stderr, never thrown). The
 * heartbeat MUST run on an interval independent of the child's own completion — `execFileSync` cannot do this
 * at all (it blocks the caller until the child exits, so nothing else can run meanwhile), which is why these
 * passes need `child_process.spawn` instead of the other passes' synchronous call.
 *
 * #xu2pp2m — RESOLVES `true` ON A CLEAN EXIT, `false` OTHERWISE, and takes explicit `args`. Both are for the
 * second caller: `review-dispatch.mjs` became a BLOCKING mechanical review (so it needs the heartbeat) whose
 * exit code gates the `review-round:<N>` label (so a swallowed failure must still be REPORTED to the caller,
 * not only to stderr). `verify-dispatch.mjs`'s call ignores the return, exactly as before.
 *
 * @param {string} scriptPath
 * @param {{ repo?:string|null, args?:string[], heartbeat:Function, label:string }} o
 * @returns {Promise<boolean>} did the child exit 0?
 */
async function runQuietHeartbeating(scriptPath, { repo = null, args: extraArgs = [], heartbeat = () => true, label } = {}) {
  if (!await heartbeat()) return false;
  const { spawn } = await import('node:child_process');
  const args = [scriptPath, ...extraArgs];
  if (typeof repo === 'string' && repo) args.push(`--repo=${repo}`);
  let timer = null;
  let ok = false;
  try {
    await new Promise((resolvePromise) => {
      const child = spawn('node', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      timer = setInterval(() => { Promise.resolve().then(heartbeat).catch(() => {}); }, MECHANICAL_PASS_HEARTBEAT_MS);
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += String(d); });
      child.on('error', (e) => {
        process.stderr.write(`⚠ mechanical pass ${label} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
        resolvePromise();
      });
      child.on('exit', (code) => {
        if (code !== 0) {
          process.stderr.write(`⚠ mechanical pass ${label} failed (non-fatal): exit ${code} ${stderr.split('\n')[0]}\n`);
        }
        ok = code === 0;
        resolvePromise();
      });
    });
  } finally {
    if (timer) clearInterval(timer);
  }
  return ok;
}

/**
 * Build the real `dispatchPass` effect (#3383): call `dispatch-lane` once per item this tick's core surfaced
 * — builds, then prepareScope, then prepareDecision, then fixes, then ciHeals ({@link tickSurface}'s own
 * order) — and hand back the bookkeeping after all of them.
 *
 * SEQUENTIAL, NEVER PARALLEL. `dispatch-lane` runs its own nested `tick-core` read per call, which updates
 * `nextState` again as it goes. Item 2 must see item 1's guard or the two could both read "not yet guarded"
 * and both clear a lane the double-dispatch guard exists to serialize — running them in parallel would reopen
 * exactly the race the guard is for.
 *
 * #3416 — EACH ITEM'S OWN GUARD IS STRIPPED FROM ITS BOOKKEEPING, RIGHT BEFORE ITS CALL, AND NOWHERE ELSE
 * ({@link bookkeepingForDispatch} below owns the why). See the file header (#3416) for how this was found
 * and confirmed unconditional, and for the still-open question of how the 2026-08-29 session's `#2936`
 * dispatch succeeded through this same call path despite it.
 *
 * THE BOOKKEEPING FILE IS BARE, not `{ bookkeeping: … }`. `forwardableBookkeeping`
 * ({@link ../../scripts/operations/dispatch-lane-io.mjs}) accepts either shape, but the wrapped one recognizes
 * only a `bookkeeping` key and reports every sibling as a DROPPED key — so wrapping `nextState` under a
 * `signals` or similar key here would make every call log a spurious drop for a key nothing ever meant to send.
 *
 * A PER-ITEM FAILURE NEVER STOPS THE TICK (mirrors `makeCliMechanicalPasses`'s "best-effort, never wedge"):
 * a spawn throw, a non-zero exit, or unparsable stdout is caught, logged to stderr, and the loop keeps the
 * PRIOR `nextState` for that item and moves on — one bad `dispatch-lane` call must not block the rest of this
 * tick's dispatches.
 *
 * `repo` IS ACCEPTED BUT NOT FORWARDED. Unlike `tick-core.mjs` / the mechanical passes, `dispatch-lane`'s own
 * declared input has no `repo` field — its repo root is resolved by script location
 * (`dispatch-lane-io.mjs`'s `REPO_ROOT`), never by a flag or cwd. Passing `--repo=` would be refused as an
 * unknown flag and fail every dispatch this tick, so the parameter exists only for call-site symmetry with
 * `makeCliTickOnce` / `makeCliMechanicalPasses`.
 */
/**
 * #3416 — bookkeeping for ONE item's own dispatch-lane call: `nextState` with THIS item's guard entries
 * stripped from every guard list (build/prepare/fix/ciHeal), everything else untouched. Pure.
 *
 * WHY THIS EXISTS. `tick-core.mjs`'s `planTick` writes a guard entry the MOMENT it decides to surface an item
 * as a spawn candidate — the same call that produces `decisions.spawnBuilds`/`spawnPrepareScope`/etc, not a
 * later one. `nextState`, as `makeCliDispatchPass`'s loop holds it before calling this, already has a guard
 * for the item about to be dispatched — the runner's own top-level read committed one for every item now
 * being processed, and each prior iteration's own nested `tick-core` call re-committed one for every item
 * STILL pending too. Left unstripped, dispatch-lane's nested read for this item sees an "already live" guard
 * for itself and refuses to dispatch — correctly, by its own duplicate-prevention logic, but the guard it is
 * honoring was written by PLANNING, never by an actual spawn, so nothing is ever dispatched. Stripping only
 * this item's own guard restores the pre-dispatch view for it alone; every other item's guard — genuinely in
 * flight, whether from a real prior dispatch or an earlier iteration of the same loop — is left exactly as
 * `nextState` already has it, so the double-dispatch and lane-collision guards those protect are unaffected.
 *
 * @param {object} nextState the tick core's current bookkeeping (buildGuards/prepareGuards/fixGuards/ciHealGuards)
 * @param {{num:*}} item the item about to be dispatched — only ITS OWN guard entries are stripped
 * @returns {object} nextState with this item's own guard entries removed from each list; everything else identical
 */
export function bookkeepingForDispatch(nextState, item) {
  const key = normNum(item && item.num);
  const stripOwnGuard = (list) => (Array.isArray(list) ? list.filter((g) => normNum(g && g.num) !== key) : list);
  return {
    ...nextState,
    buildGuards: stripOwnGuard(nextState && nextState.buildGuards),
    prepareGuards: stripOwnGuard(nextState && nextState.prepareGuards),
    fixGuards: stripOwnGuard(nextState && nextState.fixGuards),
    ciHealGuards: stripOwnGuard(nextState && nextState.ciHealGuards),
  };
}

function makeCliDispatchPass({ scriptsDir, repo = null } = {}) {
  void repo; // see the doc comment above: dispatch-lane declares no --repo input
  return async ({ out, heartbeat = () => true } = {}) => {
    let nextState = (out && out.nextState) || {};
    const d = tickSurface(out).dispatch;
    const items = [...d.builds, ...d.prepareScope, ...d.prepareDecision, ...d.fixes, ...d.ciHeals];
    if (!items.length) return { nextState };

    const { execFileSync } = await import('node:child_process');
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const runMjs = join(scriptsDir, 'operations', 'run.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'we-conveyor-dispatch-'));
    try {
      for (let i = 0; i < items.length; i += 1) {
        if (!await heartbeat()) break;
        const item = items[i];
        try {
          // #3416 — see bookkeepingForDispatch's own docblock above for why this strip exists.
          const bookkeeping = bookkeepingForDispatch(nextState, item);
          const file = join(dir, `bk-${i}.json`);
          writeFileSync(file, JSON.stringify(bookkeeping));
          const args = [runMjs, 'dispatch-lane', `--num=${item.num}`, `--bookkeepingFile=${file}`, '--json'];
          const stdout = execFileSync('node', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 32 * 1024 * 1024,
          });
          const parsed = JSON.parse(stdout);
          const updated = parsed && parsed.findings && parsed.findings.read && parsed.findings.read.tickNextState;
          if (updated && typeof updated === 'object') nextState = updated;
        } catch (e) {
          process.stderr.write(`⚠ dispatch-lane --num=${item.num} failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return { nextState };
  };
}

/**
 * #3383 — PURE. Derive this tick's TELEMETRY METRIC SAMPLES from the already-computed surface. Returns a flat
 * list of `{name, value, unit, attributes}`, ready to hand to a recorder; emits nothing itself, touches no
 * clock and no disk, so the whole saturation-capture rule set is unit-testable against a plain object.
 *
 * THE FOUR GOLDEN SIGNALS NEED A SATURATION TERM, AND THIS IS WHERE THE SYSTEM ALREADY COMPUTES ONE — it just
 * throws it away every tick. Everything below is read from numbers `planTick` has already worked out:
 *
 *   • `dispatch.admitted` / `dispatch.denied` — how many planned launches went out versus were refused, with
 *     the refusal REASON attached (`by`, e.g. `capacity-cap`). This is the headline saturation signal:
 *     `capToConcurrency` computes it against `WE_MAX_CONCURRENT_LANES` on every single tick and it has never
 *     been persisted, so "is the concurrency ceiling actually binding?" has never been answerable from data.
 *   • `heavy.admission.waiting` — how many lanes are queued on the heavy-command semaphore
 *     (`readiness/heavy-admission.mjs`, cap 2 by default). Surfaced today as one `waiting-for-capacity` note
 *     that is re-derived and discarded every tick, so the wait is visible for 120 seconds and then gone.
 *     Counts LIVE waiters only: `admissionStatus` now drops markers left by dead/aged-out waiters (they made this
 *     read 2-6 in 150/150 samples while a slot was free — see `partitionWaiting`).
 *   • `lane.pool.leased` — lanes withheld because the concurrent-lane cap was reached (`capacity-cap` notes),
 *     the pool-pressure counterpart to the admission counter.
 *   • `queue.depth` / `queue.ready` / `dispatch.inflight` — the TRAFFIC terms, straight off `counts`.
 *
 * Emitted even when zero. A tick that denied nothing is a real, load-bearing observation: without the zeros a
 * reader cannot tell "the cap was never hit" from "the runner was not running", and a denial RATE needs the
 * denominator.
 *
 * @param {object} surface the projection from {@link tickSurface}
 * @returns {Array<{name: string, value: number, unit: string, attributes: object}>}
 */
export function tickMetrics(surface) {
  const s = surface || {};
  const d = s.dispatch || {};
  const notes = Array.isArray(s.notes) ? s.notes : [];
  const suppressed = Array.isArray(s.suppressedBuilds) ? s.suppressedBuilds : [];
  const counts = s.counts && typeof s.counts === 'object' ? s.counts : {};
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const len = (a) => (Array.isArray(a) ? a.length : 0);

  const admitted = len(d.builds) + len(d.prepareScope) + len(d.prepareDecision) + len(d.fixes) + len(d.ciHeals);
  const capacityCapLanes = notes.filter((x) => x && x.kind === 'capacity-cap').length;
  const waiting = notes.filter((x) => x && x.kind === 'waiting-for-capacity').length;

  const out = [
    { name: 'dispatch.admitted', value: admitted, unit: 'count', attributes: {
      builds: len(d.builds), prepareScope: len(d.prepareScope), prepareDecision: len(d.prepareDecision),
      fixes: len(d.fixes), ciHeals: len(d.ciHeals),
    } },
    { name: 'dispatch.inflight', value: n(counts.building) + n(counts.preparing) + n(counts.fixing) + n(counts.healing), unit: 'count', attributes: {
      building: n(counts.building), preparing: n(counts.preparing), fixing: n(counts.fixing), healing: n(counts.healing),
    } },
    { name: 'queue.depth', value: n(counts.queued), unit: 'count', attributes: {} },
    { name: 'queue.ready', value: admitted, unit: 'count', attributes: {} },
    { name: 'lane.pool.leased', value: capacityCapLanes, unit: 'count', attributes: { source: 'capacity-cap-notes' } },
    { name: 'heavy.admission.waiting', value: waiting, unit: 'count', attributes: {} },
  ];

  // One `dispatch.denied` sample PER REASON, so the golden-signals rollup's `admission.reasons` breakdown
  // answers WHY the system refused work, not merely how often — the same "a count without the classification
  // is not actionable" discipline the error signal follows. A tick with no denials still emits one zero
  // sample so the denial rate has a denominator.
  const byReason = {};
  for (const x of suppressed) {
    const reason = (x && x.by) ? String(x.by) : 'unclassified';
    byReason[reason] = (byReason[reason] || 0) + 1;
  }
  if (Object.keys(byReason).length === 0) {
    out.push({ name: 'dispatch.denied', value: 0, unit: 'count', attributes: { reason: 'none' } });
  } else {
    for (const [reason, value] of Object.entries(byReason).sort(([a], [b]) => a.localeCompare(b))) {
      out.push({ name: 'dispatch.denied', value, unit: 'count', attributes: { reason } });
    }
  }
  return out;
}

/**
 * #3383 follow-on — PURE. Derive this tick's HOST-RESOURCE telemetry samples from an already-read OS snapshot,
 * mirroring {@link tickMetrics} exactly: no `os.*` call of its own, so it is unit-testable against a plain
 * object with no real host in play.
 *
 * WHY THESE SAMPLES EXIST, AND WHY THEY ARE RECORDED HERE RATHER THAN ANYWHERE ELSE. The saturation metrics
 * above answer "is the QUEUE or LANE POOL the constraint"; nothing in the system today records whether the
 * HOST itself — CPU, memory — is the actual ceiling as more concurrent dispatch capacity gets added. Recording
 * these in the SAME `emitTickMetrics` call, at the SAME cadence and the SAME `tick` attribute as the dispatch
 * metrics, is what makes them ANSWER that question later: a scoring pass can join "how loaded was the machine"
 * against "how much dispatch throughput was happening" at the same points in time, rather than reading host
 * load in isolation (which would say nothing about whether it was actually binding on delivery).
 *
 * WHAT THIS DOES NOT CAPTURE, STATED PLAINLY (see the file's own `readHostSample` for the swap tradeoff):
 *   • SWAP USAGE — no cross-platform in-process Node API exists for it; see {@link readHostSample}.
 *   • DISK I/O, NETWORK — no `node:os` accessor exists for either; adding them would mean shelling out
 *     (`iostat`/`nettop`/`/proc/...`), which this file's own no-subprocess discipline (mirrored from
 *     `telemetry-store.mjs`) argues against for a per-tick sample.
 *   • PER-PROCESS / PER-CONTAINER breakdown from THESE `os.*` samples specifically — `os.loadavg()`/
 *     `os.freemem()` are whole-HOST aggregates and cannot themselves attribute load to any one process. This
 *     is now covered by a SIBLING sample, not by this function: {@link module:host-process-sample} keeps
 *     `conveyor`/`drain`/`dispatched_agents` as fixed totals and records every OTHER process that clears its
 *     storage floor as its OWN row (via `ps`, once per tick, right alongside this one — see
 *     `emitTickMetrics`), and the harder per-agent-turn case (a delivery agent's own CPU cost) is covered by
 *     `telemetry-store.mjs#spanAroundAsyncWithCpu` on the `agent.turn` span itself. Neither follow-on touches
 *     `hostMetrics`/`readHostSample` here, which is why this docblock still describes only the whole-machine
 *     `os.*` gauges.
 *
 * @param {{loadavg?: number[], freeBytes?: number, totalBytes?: number, cpuCount?: number}} [sample]
 * @returns {Array<{name: string, value: number, unit: string, attributes: object}>}
 */
export function hostMetrics(sample) {
  const s = sample || {};
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const la = Array.isArray(s.loadavg) ? s.loadavg : [];
  const [l1, l5, l15] = la;
  return [
    { name: 'host.cpu.load1', value: n(l1), unit: 'count', attributes: {} },
    { name: 'host.cpu.load5', value: n(l5), unit: 'count', attributes: {} },
    { name: 'host.cpu.load15', value: n(l15), unit: 'count', attributes: {} },
    // Recorded EVERY tick alongside the load averages, not once — see METRIC_NAMES' own comment in
    // telemetry.mjs for why (cheap, and a later analysis should never need a second lookup to compute
    // load-vs-cores).
    { name: 'host.cpu.count', value: n(s.cpuCount), unit: 'count', attributes: {} },
    // RAW bytes, not a ratio — see telemetry.mjs's own comment: a ratio alone cannot recover the total.
    { name: 'host.mem.free_bytes', value: n(s.freeBytes), unit: 'bytes', attributes: {} },
    { name: 'host.mem.total_bytes', value: n(s.totalBytes), unit: 'bytes', attributes: {} },
  ];
}

/**
 * IO EDGE — the one place this feature touches `node:os` directly, kept to exactly this so {@link hostMetrics}
 * above stays pure. Never throws: a read failure (no known real one, but this runs inside the RESIDENT driver,
 * where the watchdog's discipline applies — an observability read must never be able to stop the conveyor)
 * degrades to a zeroed sample rather than taking a tick down.
 *
 * SWAP USAGE IS DELIBERATELY NOT SAMPLED — the tradeoff, stated rather than silently skipped. Node's `os`
 * module has no swap accessor on any platform; the only way to get it is shelling out (macOS: `sysctl
 * vm.swapusage` / `vm_stat`; Linux: parsing `/proc/meminfo`'s `SwapTotal`/`SwapFree`, itself not portable to
 * macOS). `telemetry-store.mjs`'s own purity discipline forbids a subprocess in the recorder's hot path for
 * exactly this reason (cost + a new failure mode on every sample), and this sampling point runs on the SAME
 * ~120s cadence as every other tick metric — spawning a process every tick for one more gauge was judged not
 * worth it against `os.loadavg()`'s CPU pressure signal already covering the same "is the host saturated"
 * question the swap number would answer indirectly. Revisit if a later capacity-planning pass finds load
 * average alone insufficient to explain an observed slowdown.
 * @returns {{loadavg: number[], freeBytes: number, totalBytes: number, cpuCount: number}}
 */
export function readHostSample() {
  try {
    return { loadavg: loadavg(), freeBytes: freemem(), totalBytes: totalmem(), cpuCount: cpus().length };
  } catch {
    return { loadavg: [0, 0, 0], freeBytes: 0, totalBytes: 0, cpuCount: 0 };
  }
}

/** Emit one already-computed metric list under this tick's shared `tick` attribute, isolated in its own
 *  try/catch so a bad sample can never take a SIBLING group down with it (see {@link emitTickMetrics}'s
 *  own docblock for why the three groups below each get one of these instead of sharing one try/catch). A
 *  failure is LOGGED, not swallowed — `⚠ … (non-fatal)` matches this file's own convention for every other
 *  best-effort mechanical pass (see e.g. the reconcile-pass/hiccup-sink call sites), so a partial tick is
 *  never silently indistinguishable from "nothing to emit". Never throws.
 * @param {object} recorder
 * @param {string} label identifies which group failed, for the log line
 * @param {() => Array<{name: string, value: number, unit?: string, attributes?: object}>} computeMetrics
 * @param {number|undefined} tick
 */
function emitMetricGroup(recorder, label, computeMetrics, tick) {
  try {
    for (const m of computeMetrics()) {
      recorder.recordMetric(m.name, m.value, { unit: m.unit, attributes: { ...m.attributes, tick } });
    }
  } catch (e) {
    process.stderr.write(`⚠ telemetry ${label} metrics failed mid-tick (non-fatal): ${String((e && e.message) || e).split('\n')[0]}\n`);
  }
}

/**
 * #3383 — IO. Record this tick as one `runner.tick` span plus {@link tickMetrics}' and {@link hostMetrics}'
 * samples — the dispatch/queue saturation signals and the host-resource signals, side by side, at the SAME
 * `tick` attribute (see {@link hostMetrics}'s own docblock for why that co-location is the whole point).
 *
 * EACH GROUP IS ISOLATED (bugfix, #3383 follow-on): this used to wrap the span-open, all three metric-emission
 * loops, and `span.ok()` in ONE try/catch, so a throw partway through — e.g. `hostMetrics(readHostSample())`
 * mid-loop — silently dropped every group after it AND skipped `span.ok()`, with nothing logged; a partial
 * tick was indistinguishable from a tick with nothing to emit. Now the span open/close is its own guarded
 * step and each metric group runs through {@link emitMetricGroup}, so `tick`/`host`/`process` metrics succeed
 * or fail independently and any real failure is at least visible on stderr — still never able to stop the
 * conveyor (this runs inside the RESIDENT driver, where the discipline is the watchdog's), just no longer
 * silently total. The tick span is zero-width by construction (the surface is already computed by the time
 * `emit` is called); it exists to carry the per-tick attributes and to give the metrics a sibling in the same
 * trace, not to time the tick.
 */
function emitTickMetrics(recorder, surface, ctx) {
  const tick = ctx && ctx.tick;
  let span;
  try {
    span = recorder.startSpan('runner.tick', {
      attributes: { tick, statusLine: (surface && surface.statusLine) || null },
    });
  } catch (e) {
    process.stderr.write(`⚠ telemetry runner.tick span open failed (non-fatal): ${String((e && e.message) || e).split('\n')[0]}\n`);
    span = null;
  }

  emitMetricGroup(recorder, 'tick', () => tickMetrics(surface), tick);
  emitMetricGroup(recorder, 'host', () => hostMetrics(readHostSample()), tick);
  // #3383 follow-on — per-process attribution, REDESIGNED (telemetry-granularity follow-on): ONE `ps`
  // shell-out per tick (matching the whole-machine sample's own cadence, never a hot path). `conveyor`/`drain`/
  // `dispatched_agents` stay fixed totals; every OTHER process that clears the storage floor is recorded as
  // its own row (real pid + command, not a `vscode`/`chrome`/`other` bucket). See `host-process-sample.mjs`
  // for the full pure/IO split and the real-data sizing math behind the floor; `readProcessSample` never
  // throws (an empty sample on any `ps` failure), so a missing/unexpected `ps` degrades to zeroed totals and no
  // rows, not a broken tick.
  emitMetricGroup(recorder, 'process', () => processSnapshotMetrics(buildProcessSnapshot(readProcessSample())), tick);

  if (span) {
    try {
      span.ok();
    } catch (e) {
      process.stderr.write(`⚠ telemetry runner.tick span close failed (non-fatal): ${String((e && e.message) || e).split('\n')[0]}\n`);
    }
  }
}

export const DRIVER_STATUS_FILENAME = 'driver-status.json';

/**
 * Write the tick's surface to a durable file OUTSIDE the runner's own stdout, so "is the driver stuck?" is
 * answerable from a SEPARATE process (a human, another agent, `scripts/conveyor/driver-status.mjs`) without
 * grepping `runner.log` or waiting on a notification (2026-09-14, #3521/lane-2 incident — the driver ran for
 * 85+ minutes with its only record of the stall sitting in a log nobody was polling). Overwritten every tick;
 * atomic (temp file + rename) so a concurrent reader never observes a half-written file. Best-effort — a write
 * failure (e.g. a read-only checkout) is swallowed: the status file is a CONVENIENCE, never something the tick
 * loop itself depends on to keep running.
 * @param {string} path  the resolved `.conveyor/driver-status.json` path.
 * @param {{tick:number}} ctx
 * @param {object} surface  this tick's {@link tickSurface} projection.
 */
export function writeDriverStatus(path, ctx, surface) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const at = ctx.at ?? new Date().toISOString();
    try {
      const previous = JSON.parse(readFileSync(path, 'utf8'));
      if (Date.parse(previous.at) > Date.parse(at)) return false;
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const body = JSON.stringify(
      {
        tick: ctx.tick,
        at, driverId: ctx.driverId ?? DRIVER_ID, tickId: ctx.tickId ?? `${DRIVER_ID}#${ctx.tick}`,
        statusLine: surface.statusLine || '',
        stalled: Array.isArray(surface.stalled) ? surface.stalled : [],
        dispatch: surface.dispatch,
      },
      null,
      2,
    ) + '\n';
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, body);
    renameSync(tmp, path);
  } catch (e) {
    process.stderr.write(`⚠ driver-status write failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
  }
}

/**
 * Append this tick's plain-language decision trace (see `buildDecisionTrace` / `tick-core.mjs`) to a durable,
 * DAY-SHARDED JSONL sidecar — `<traceDir>/<YYYY-MM-DD>.jsonl`, ONE line per trace entry, mirroring the existing
 * `.operations/telemetry/<date>.jsonl` day-sharding convention already in this repo so the trace's own growth is
 * naturally bounded to a day's worth of ticks per file instead of one ever-growing log. A DELIBERATELY SEPARATE
 * sidecar rather than piggybacking on `.operations/telemetry/` (2026-09-14): that store has an active
 * test-pollution/fragmentation fix in flight elsewhere at the time this was built, so writing into it here would
 * risk colliding with that in-progress change; once it lands, folding this trace into the shared store is the
 * natural next step (this file's whole schema is a flat, appendable line — nothing here depends on a private
 * format). Best-effort, same as {@link writeDriverStatus} — a write failure never gates the tick.
 * @param {string} traceDir  the resolved `.conveyor/decision-trace/` directory.
 * @param {{tick:number}} ctx
 * @param {Array<object>} entries  this tick's `surface.decisionTrace`.
 */
export function appendDecisionTrace(traceDir, ctx, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  try {
    mkdirSync(traceDir, { recursive: true });
    const at = new Date(ctx.at ?? Date.now());
    // #2747 — the day-shard is the OPERATOR's calendar day (`localDateString`), not the runtime's UTC day.
    const day = localDateString(at);
    const lines = entries.map((e) => JSON.stringify({ ...e, tick: ctx.tick, at: at.toISOString(), driverId: ctx.driverId ?? DRIVER_ID, tickId: ctx.tickId ?? `${DRIVER_ID}#${ctx.tick}` })).join('\n') + '\n';
    appendFileSync(join(traceDir, `${day}.jsonl`), lines);
  } catch (e) {
    process.stderr.write(`⚠ decision-trace write failed (non-fatal): ${String(e.message || e).split('\n')[0]}\n`);
  }
}

/** Build the real `emit` effect: print the tick's status line + notes, and the dispatch/watch decisions the
 *  judgment layer executes (the runner spends no model context, so it surfaces them — #2701 clause 3). Also
 *  writes the durable external status file every tick (see {@link writeDriverStatus}) and appends the tick's
 *  decision trace (see {@link appendDecisionTrace}), both regardless of `json`. */
function makeCliEmit({ json = false, recorder = null, statusPath = null, traceDir = null } = {}) {
  const tel = recorder || createTelemetryRecorder({ kind: 'runner', traceId: `runner-${process.pid}` });
  return (surface, ctx) => {
    emitTickMetrics(tel, surface, ctx);
    if (statusPath) writeDriverStatus(statusPath, ctx, surface);
    if (traceDir) appendDecisionTrace(traceDir, ctx, surface.decisionTrace);
    if (json) { process.stdout.write(JSON.stringify({ tick: ctx.tick, ...surface }) + '\n'); return; }
    const { dispatch } = surface;
    const counts = `${dispatch.builds.length} build · ${dispatch.prepareScope.length + dispatch.prepareDecision.length} prepare · ${dispatch.fixes.length} fix · ${dispatch.ciHeals.length} heal · ${surface.armWatchers.length} watch`;
    process.stdout.write(`[tick ${ctx.tick}] ${surface.statusLine || '(no status)'}\n`);
    if (dispatch.builds.length || dispatch.prepareScope.length || dispatch.prepareDecision.length || dispatch.fixes.length || dispatch.ciHeals.length || surface.armWatchers.length) {
      process.stdout.write(`  ↳ surface for judgment layer: ${counts}\n`);
    }
    for (const n of surface.notes) process.stdout.write(`  ${n.text || JSON.stringify(n)}\n`);
  };
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Coerce a flag value to a finite number, falling back when it is absent / bare (`true`) / non-numeric —
 *  so `--max-ticks=abc` can never silently become `NaN` (which would never trip the max-ticks stop). */
function finiteOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * `--scope-to-queue` → the env every child process this runner shells must inherit (epic #3383). PURE: returns
 * the patch, never applies it, so the whole decision is unit-testable with no process env in play.
 *
 * WHY AN ENV PATCH AND NOT AN IN-MEMORY FLAG. This runner barely does anything itself — it SHELLS
 * `tick-core.mjs`, `reconcile-pass.mjs`, `review-dispatch.mjs`, the watch sweeps and `verify-dispatch.mjs`, and
 * each of those resolves its own sidecars through its own `resolve*Path()` call. A flag that only changed this
 * process's in-memory state would scope the parent and leave every child reading the unscoped default — which
 * is the WORST outcome available, because it LOOKS scoped and is not. (This is the shape `#3639`'s own Fork
 * 2(C) argues is forced by the architecture rather than chosen.)
 *
 * The flag is a pure OVERRIDE of the `.conveyor/queue-scope.json` marker, not a replacement for it: a scratch
 * checkout can carry the marker and need no flag, and an operator can scope one bounded run without writing
 * any file. An ABSENT flag patches NOTHING — it must not force scoping OFF, or it would override a marker the
 * operator deliberately set.
 * @param {object} flags parsed CLI flags
 * @returns {object} an env patch (`{}` when the flag is absent)
 */
export function queueScopeEnvPatch(flags) {
  return flags && flags['scope-to-queue'] ? { [QUEUE_SCOPE_ENV]: '1' } : {};
}

/**
 * Acquire the singleton lease, drive the loop, and ALWAYS release the lease — the lifecycle wrapper, kept
 * SEPARATE from `main()` so it is unit-testable without `process.exit` (which does NOT unwind a `finally`, so
 * the release MUST NOT sit behind an exit). A held lease returns `{ started: false }` so the caller stands
 * down; otherwise the lease is released in the `finally` before the caller exits. The lease heartbeat is wired
 * IN here (over the injected `heartbeat`), so the loop's lease-loss stop reflects the real singleton right.
 * @returns {Promise<{ started: boolean, reason?: string, heldBy?: string|null, ticks?: number, stoppedReason?: string }>}
 */
export async function driveConveyor({
  lockRoot = RUNNER_LOCK_ROOT,
  owner = runnerOwner(),
  buildEffects,
  acquire = acquireRunnerLease,
  heartbeat = heartbeatRunnerLease,
  release = releaseRunnerLeaseIfOwned,
} = {}) {
  if (typeof buildEffects !== 'function') throw new TypeError('driveConveyor requires a buildEffects factory');
  const acq = acquire(lockRoot, owner);
  if (!acq.ok) return { started: false, reason: acq.reason || 'held', heldBy: acq.heldBy ?? null };
  try {
    const effects = { ...buildEffects(owner), heartbeat: () => heartbeat(lockRoot, owner) };
    const result = await runLoop(effects);
    return { started: true, ticks: result.ticks, stoppedReason: result.stoppedReason };
  } finally {
    // Release BEFORE the caller exits — never behind a `process.exit` (which would skip it and leak the lease
    // for the full TTL, falsely standing down every launch inside that window). This is the drain daemon's
    // release-then-exit ordering (we:scripts/lane-drain.mjs), not a finally-after-exit.
    release(lockRoot, owner);
  }
}

/**
 * The final `--json` line the supervisor parses off this runner's stdout to tell a POLITE STAND-DOWN apart
 * from a genuine IDLE-STOP (#3406). Kept as a PURE function, separate from the writing, for one reason: the
 * exact byte shape is a CROSS-MODULE CONTRACT with `supervisor.mjs`'s `makeRealSpawnChild` line parser
 * (`{event:'stopped', stoppedReason}` / `{event:'stood-down'}` — note the field is `stoppedReason`, NOT
 * `reason`), and a contract only one side can construct is a contract neither side can test. With this
 * exported, the suite feeds THIS function's real output into THAT parser's real input and proves the two
 * halves agree, rather than restating the shape in a test fixture that can drift from both.
 * @param {{ started: boolean, heldBy?: string|null, stoppedReason?: string, ticks?: number }} outcome
 * @returns {string} one JSON line (no trailing newline)
 */
export function finalEventLine(outcome) {
  return outcome && outcome.started
    ? JSON.stringify({ event: 'stopped', stoppedReason: outcome.stoppedReason, ticks: outcome.ticks })
    : JSON.stringify({ event: 'stood-down', heldBy: (outcome && outcome.heldBy) ?? null });
}

/** The signals a runner shuts down on. SIGTERM is what `supervisor.mjs`'s `shutdown` sends its child (and what
 *  a manual `kill` sends by default); SIGINT is a foreground Ctrl-C. */
export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'];

/**
 * Install the SIGTERM/SIGINT shutdown handler that RELEASES THE SINGLETON LEASE before the process dies.
 *
 * WHY THIS EXISTS (the leak it fixes). `driveConveyor`'s `finally` releases the lease on every exit path the
 * JS runtime controls — a clean stop, a thrown tick. A SIGNAL is not one of those: an unhandled SIGTERM
 * terminates the process outright, the `finally` never unwinds, and the lease is LEAKED for its full 15-minute
 * TTL. `acquireRunnerLease` passes pidLiveness `'unknown'`, so there is no dead-pid fast path to rescue it
 * either — the lock dir simply looks live. The observable damage is a restart storm, not just a stale file:
 * the next runner finds a live-looking lease, stands down, and exits in well under `supervisor.mjs`'s
 * `crashThresholdMs`, which `classifyExit` reads as `'too-short'` ⇒ a CRASH — so the supervisor backs off,
 * doubles, and eventually fires a `crash-loop-at-ceiling` desktop alert for a conveyor that is not crashing at
 * all. `supervisor.mjs`'s own `shutdown` comment assumed this handler already existed ("runner.mjs gets a
 * chance to run its own driveConveyor `finally`"); it did not, so its 5-second SIGTERM grace bought nothing.
 * A real leaked lease of exactly this shape was found on the dev machine (pid dead, heartbeat 6.5 h old).
 *
 * RE-RAISE, NEVER `process.exit(0)`. After releasing, the handler removes itself and re-sends the SAME signal
 * so the process dies BY THAT SIGNAL, exactly as it does today. That is deliberate: `classifyExit` short-
 * circuits on `signal` before it ever looks at the exit code, so exiting 0 here would silently reclassify
 * every killed runner as a CLEAN exit and hand it #3406's prompt-restart path. Releasing the lease is the
 * whole fix; the exit semantics must not move with it.
 *
 * LIMIT, stated plainly: Node dispatches signal handlers on the event loop, so a signal arriving while the
 * runner is inside a BLOCKING `execFileSync` mechanical pass is not handled until that child returns. The
 * supervisor's 5-second SIGTERM→SIGKILL grace can therefore still expire on a long synchronous pass, and that
 * case still leaks. Narrowing it means moving those passes off `execFileSync` (the `runQuietHeartbeating`
 * treatment #3404 already gave `verify-dispatch.mjs`) — out of scope here, and a strictly smaller window than
 * the "every single SIGTERM leaks" this fixes.
 *
 * Every effect is injectable so the unit suite can drive the handler without signalling the test runner
 * itself; the live proof spawns a REAL child and sends it a REAL SIGTERM.
 * @returns {{ dispose: () => void }} removes the handlers (for tests / a caller that shuts down some other way)
 */
export function installShutdownHandlers({
  lockRoot = RUNNER_LOCK_ROOT,
  owner = runnerOwner(),
  release = releaseRunnerLeaseIfOwned,
  signals = SHUTDOWN_SIGNALS,
  on = (sig, fn) => process.on(sig, fn),
  off = (sig, fn) => process.removeListener(sig, fn),
  raise = (sig) => process.kill(process.pid, sig),
  log = (s) => process.stderr.write(s),
} = {}) {
  let shuttingDown = false;
  const handlers = new Map();
  const dispose = () => { for (const [sig, fn] of handlers) off(sig, fn); handlers.clear(); };
  for (const sig of signals) {
    const fn = () => {
      // A second signal while the first is still unwinding must not double-release (the release is
      // owner-fenced and idempotent, but a re-raise loop would be a real hang) — same guard shape as
      // `supervisor.mjs`'s own `stopRequested`.
      if (shuttingDown) return;
      shuttingDown = true;
      // Owner-fenced and idempotent: a no-op when the lease was never acquired (a signal during startup) or
      // was already reclaimed by someone else. NEVER let a release failure stop us from dying.
      let released = false;
      try { released = release(lockRoot, owner); } catch { /* best-effort; the TTL is the backstop */ }
      log(`conveyor runner: ${sig} — singleton lease ${released ? 'released' : 'not held'}; exiting.\n`);
      dispose();               // so the re-raise below hits Node's DEFAULT disposition, not this handler again
      raise(sig);
    };
    handlers.set(sig, fn);
    on(sig, fn);
  }
  return { dispose };
}

/**
 * RECORD THE LAUNCH POSTURE (epic #3383) — write `<root>/.conveyor/driver-mode.json` saying whether this
 * runner was started RESIDENT (keep driving until stopped) or BOUNDED (`--once` / `--max-ticks=N`: run that
 * many ticks and exit). This process is the only thing in the system that knows.
 *
 * THE BUG IT FIXES. `we:scripts/conveyor/driver-watchdog.mjs` answers "is the driver up?" from the singleton
 * lease alone, and an absent lease meant, unconditionally, "crash". A runner started `--once` breaks that: it
 * runs its tick, dispatches, exits 0 and releases its lease CLEANLY — and the watchdog then logged a crash
 * every five minutes about a process that had done exactly what it was asked. Nothing on disk distinguished
 * "stopped because it was told to" from "died", so it is written here, at the one point that has the flags in
 * hand, and the watchdog reads it through the shared sidecar GRAMMAR
 * ({@link ../../scripts/conveyor/driver-mode.mjs}) rather than importing this file — whose whole design rests
 * on the watchdog reaching NONE of the driver's own logic.
 *
 * BEST-EFFORT, NEVER FATAL: a runner that refused to start because it could not write an observability sidecar
 * would be a far worse failure than the mis-report it prevents. `writeDriverMode` returns its error instead of
 * throwing, and the worst case is exactly the pre-#3383 behaviour — no marker ⇒ the watchdog assumes resident.
 *
 * Split out of `main` and exported ONLY so the flags→posture→sidecar path is unit-testable without spawning a
 * runner (which would drive the real conveyor); it is not a caller-facing entry point.
 *
 * @param {object} o
 * @param {object} o.flags - {@link parseFlags}' output.
 * @param {number} o.maxTicks - already resolved by `main` (`--once` ⇒ 1, else `--max-ticks` or `Infinity`), so
 *   the posture can never disagree with the ceiling the loop will actually run to.
 * @param {string} o.root - the driver checkout, i.e. where `.conveyor/` lives.
 */
export function recordLaunchPosture({
  flags = {}, maxTicks = Infinity, root, pid = process.pid,
  write = writeDriverMode, warn = (s) => process.stderr.write(s), ...io
} = {}) {
  const res = write({ root, mode: driverModeFor({ once: !!flags.once, maxTicks }), maxTicks, pid, ...io });
  if (!res.ok) warn(`conveyor runner: could not record the driver mode (${res.error}) — the watchdog will assume resident.\n`);
  return res;
}

async function main(argv) {
  const flags = parseFlags(argv);

  const HERE = dirname(fileURLToPath(import.meta.url));
  // Runner lives in skills-src/conveyor/; the tick core + the deterministic passes live in scripts/.
  const SCRIPTS_DIR = join(HERE, '..', '..', 'scripts');
  const TICK_CORE = join(SCRIPTS_DIR, 'conveyor', 'tick-core.mjs');
  // The checked-out repo root this runner is driving — resolved by SCRIPT LOCATION (never CWD), the same
  // convention `queue-scope.mjs` documents for its own sidecar, so a child process's own cwd can never point
  // the status file / trace dir at a different checkout than the one actually running.
  const REPO_ROOT = join(HERE, '..', '..');
  const STATUS_PATH = join(REPO_ROOT, '.conveyor', DRIVER_STATUS_FILENAME);
  const TRACE_DIR = join(REPO_ROOT, '.conveyor', 'decision-trace');

  const repo = typeof flags.repo === 'string' ? flags.repo : null;
  const json = !!flags.json;
  const intervalMs = finiteOr(flags['interval-ms'], DEFAULT_TICK_INTERVAL_MS);
  const maxTicks = flags.once ? 1 : finiteOr(flags['max-ticks'], Infinity);

  // epic #3383 — see {@link recordLaunchPosture}. Runs before anything can stand the runner down, so the
  // marker describes every launch, not only the ones that went on to hold the lease.
  recordLaunchPosture({ flags, maxTicks, root: join(HERE, '..', '..') });

  // epic #3383 — applied BEFORE any effect is built, so every child this runner shells (and this process's own
  // `isQueueScopeEnabled()` reads) sees it. Announced on stderr because a scoped runner that says nothing is
  // indistinguishable from a broken one: the passes below will look like they are finding no work.
  Object.assign(process.env, queueScopeEnvPatch(flags));
  if (isQueueScopeEnabled()) {
    const ids = readScopedQueueIds();
    process.stderr.write(`⊂ conveyor runner is QUEUE-SCOPED — repo-wide mechanical passes act only on: ${ids.length ? ids.join(', ') : '(nothing — this checkout\'s queue is empty)'}\n`);
  }

  const hiccupSession = typeof flags['hiccup-session'] === 'string' ? flags['hiccup-session'] : undefined;
  const buildEffects = () => ({
    coordination: createTickCoordination(),
    reportCoordination: (rows) => {
      for (const row of rows.filter((r) => r.reason && r.reason !== 'held')) {
        process.stderr.write(`conveyor coordination: ${row.reason} ${row.record?.resource ?? ''}${row.error ? ` — ${row.error}` : ''}\n`);
      }
    },
    tickOnce: makeCliTickOnce({ tickCorePath: TICK_CORE, repo }),
    emit: makeCliEmit({ json, statusPath: STATUS_PATH, traceDir: TRACE_DIR }),
    dispatchPass: makeCliDispatchPass({ scriptsDir: SCRIPTS_DIR, repo }),
    mechanicalPasses: makeCliMechanicalPasses({ scriptsDir: SCRIPTS_DIR, repo, hiccupSession }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    intervalMs,
    maxTicks,
    initial: {},
  });

  // #2702 SINGLETON LOCK — `driveConveyor` acquires the sole-driver right, runs the loop, and ALWAYS releases
  // the lease (in its `finally`, before we exit). A LIVE runner already driving ⇒ `started:false`, a polite
  // stand-down (exit 0, not an error).
  //
  // …but a `finally` covers only the exit paths the runtime unwinds. A SIGTERM (the supervisor's own shutdown,
  // or a manual kill) is not one — it kills the process outright and LEAKS the lease for the full 15-minute
  // TTL, falsely standing every launch down inside that window. Installed BEFORE the acquire, so a signal
  // arriving mid-startup is covered too (the release is owner-fenced, so a not-yet-acquired lease is a no-op).
  const owner = runnerOwner();
  installShutdownHandlers({ owner });
  const outcome = await driveConveyor({ owner, buildEffects });
  if (!outcome.started) {
    process.stderr.write(`✗ another conveyor runner holds the singleton lease (heldBy=${outcome.heldBy}); standing down.\n`);
    // #3406 — a stand-down and a genuine idle-stop both exit code 0, and were previously indistinguishable
    // from the supervisor's side. Under `--json` (how the supervisor always launches this), surface the fact
    // explicitly as one final structured line so the supervisor never has to guess from the exit code alone —
    // a stand-down must still restart PROMPTLY (another runner already covers the singleton right), unlike an
    // idle-stop, which the supervisor should back off from re-spawning immediately (see supervisor.mjs).
    if (json) writeLineSync(1, finalEventLine(outcome));
  } else {
    process.stderr.write(`conveyor runner stopped: ${outcome.stoppedReason} after ${outcome.ticks} tick(s).\n`);
    if (json) writeLineSync(1, finalEventLine(outcome));
  }
  process.exit(0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ runner error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}
