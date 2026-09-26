/**
 * @file scripts/operations/live-state.mjs
 * @description Card xvz55jf (epic #3931, "Live work transparency on Plateau /wip") — the declared, read-only
 *   `live-state` operation: ONE JSON snapshot answering "is the machine that runs the conveyor healthy right
 *   now", so the operator stops being blind between explicit `daemon-status`/`heavy-queue`/`queue` checks. Same
 *   READ / ASSESS SPLIT `daemon-status.mjs` (#4067) and `heavy-queue.mjs` (card xb0iuxq) already use: {@link
 *   ./live-state-io.mjs}'s `collectLiveState` does every real read; every function in THIS file is a pure
 *   classification over that already-read snapshot.
 *
 * REUSE, NEVER RE-DERIVE. Every section below reads a snapshot this operation did not invent:
 *   - `daemons` is `assessDaemonStatus(collectDaemonStatus())` — {@link ./daemon-status.mjs}'s OWN assessed
 *     shape, verbatim. This file only picks a colour off fields that module already computed
 *     (`anyRefusing`/`anyDown`/`anyStalled`/`anyRecentAlerts`) — it never re-classifies a single daemon.
 *   - `testQueue` is `assessHeavyQueue(collectHeavyQueue())` — {@link ./heavy-queue.mjs}'s own assessed shape,
 *     verbatim, including its `queueAdmission.maxWaitMinutes` budget (never a second constant for it).
 *   - `health` is the health watch's own open-episode store, read structurally by {@link
 *     ../conveyor/health-watch-section.mjs#openHealthEpisodesData} (the sibling of the `--with-health` lines
 *     `operator-queue.mjs` already prints) — the episode `status` (`open`/`flapping`) is READ, never
 *     re-derived from the raw breach counters.
 *   - `lanes` is `lane-pool.mjs status --json`'s own per-lane `clean`/`leased` fields, counted, not re-scanned.
 *   - `drain` is the drain daemon's own `history.jsonl` last line — its own recorded `exit`/`considered`/
 *     `merged`/`failed`, not a re-run of the drain.
 *   - `githubAuth` is `readGithubAppStatus` (`../lib/github-app-auth-env.mjs`) — the SAME shared status file
 *     `we:scripts/conveyor/github-app-status.mjs` already reports off of.
 *   - `machineLoad` is `os.loadavg()`/`os.cpus().length` — no daemon owns this reading yet, so it is the one
 *     section with no existing operation to defer to.
 *
 * THRESHOLDS ARE DOCUMENTED HERE, NOT SCATTERED. Every number below is a named export with the reasoning
 * beside it, per the card's own "thresholds are documented in the file" requirement.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { DEFAULT_HEALTH_CONFIG } from '../conveyor/health-watch-core.mjs';

export const LIVE_STATE_OP = 'live-state';

/** The three traffic-light colours a section (and the overall snapshot) may carry. Order matters for
 *  {@link worstStatus}: a later entry never loses to an earlier one. */
export const STATUS_ORDER = Object.freeze(['green', 'yellow', 'red']);

/** @param {string[]} statuses @returns {string} the worst (rightmost in {@link STATUS_ORDER}) of the given statuses,
 *  or `'green'` for an empty list — an empty section list has nothing wrong with it. */
export function worstStatus(statuses) {
  return statuses.reduce((worst, s) => (STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(worst) ? s : worst), 'green');
}

// ── thresholds ───────────────────────────────────────────────────────────────────────────────────────────────

/** TEST QUEUE. `heavy-queue.mjs`'s own `queueAdmission.maxWaitMinutes` budget is reused for the red line — never
 *  a second, disagreeing constant. The green line below is NEW to this operation and mirrors the delivery
 *  plan's own operating rule ("a new worker starts only if the heavy test queue's estimated wait is under ~15
 *  min", `~/.claude/daemon-delivery-plan.md` "Flow control"): a wait under that same 15-minute bar is green, a
 *  wait past it but still inside the admission budget is yellow, and a wait that would make the CURRENT budget
 *  itself refuse new work is red. */
export const QUEUE_GREEN_MAX_MINUTES = 15;
/** Fallback red line when no live `queueAdmission` budget was read (heavy-admission not configured on this
 *  host) — kept generous (double the green line) so a missing budget reads as "watch it", never a false red. */
export const QUEUE_YELLOW_FALLBACK_MAX_MINUTES = 30;

/** LANES. A free-lane count this low means the next `acquire` risks queueing or a forced grow; `0` means the
 *  very next acquire attempt fails outright unless the pool grows. Chosen from the same order of magnitude the
 *  delivery plan's own lane counts moved in (32 → 86 free, #4139) — single digits is the "notice it" band. */
export const LANE_FREE_RED_MAX = 0;
export const LANE_FREE_YELLOW_MAX = 4;

/** DRAIN. How old the last recorded pass may be before it reads as "may have stopped ticking" — chosen from the
 *  live pass cadence this snapshot's own dev session observed (a pass roughly every 1–1.5 min, see
 *  `plateau-app:.drain-daemon/history.jsonl`): 10 minutes is several missed cycles, 30 is unambiguous. */
export const DRAIN_STALE_YELLOW_MS = 10 * 60 * 1000;
export const DRAIN_STALE_RED_MS = 30 * 60 * 1000;

/** MACHINE LOAD. 1-minute loadavg compared to core count — the standard "load above core count means work is
 *  queueing for CPU" read. Yellow at 1x cores, red at 2x, matching the delivery plan's own informal "load ~4"
 *  running commentary against a machine this operation expects to be in the single-digit core range. */
export const LOAD_YELLOW_RATIO = 1;
export const LOAD_RED_RATIO = 2;

// ── per-section assess (pure) ────────────────────────────────────────────────────────────────────────────────

/** @param {object} daemonStatus - `assessDaemonStatus`'s own return shape (`./daemon-status.mjs`), verbatim. */
export function assessDaemonsSection(daemonStatus) {
  if (daemonStatus?.anyRefusing) {
    return { status: 'red', reason: `refusing everything: ${daemonStatus.refusingDaemons.join(', ')}` };
  }
  const flags = [];
  if (daemonStatus?.anyDown) flags.push(`down: ${daemonStatus.downDaemons.join(', ')}`);
  if (daemonStatus?.anyStalled) flags.push(`stalled: ${daemonStatus.staleDaemons.join(', ')}`);
  if (daemonStatus?.anyRecentAlerts) flags.push(`recent rebuild alerts: ${daemonStatus.alertingDaemons.join(', ')}`);
  if (flags.length) return { status: 'yellow', reason: flags.join('; ') };
  return { status: 'green', reason: `${daemonStatus?.daemons?.length ?? 0} daemon(s), all alive and ticking cleanly` };
}

/** @param {{lastTick:object|null, running:boolean, episodes:Array<object>}} health -
 *  `openHealthEpisodesData`'s own return shape (`../conveyor/health-watch-section.mjs`), verbatim. */
export function assessHealthSection(health, { now = Date.now(), staleAfterMs = DEFAULT_HEALTH_CONFIG.healthStaleAfterMs } = {}) {
  if (!health?.running) return { status: 'yellow', reason: 'the health watch has never completed a tick' };
  const stale = now - health.lastTick.completedAt > staleAfterMs;
  const high = health.episodes.filter((e) => e.severity === 'high');
  if (high.length) {
    return { status: 'red', reason: `${high.length} high-severity open episode(s): ${high.map((e) => `${e.smell}/${e.subject}`).join(', ')}` };
  }
  if (stale) return { status: 'yellow', reason: 'the health watch tick is stale — it may have stopped running' };
  if (health.episodes.length) {
    return { status: 'yellow', reason: `${health.episodes.length} open episode(s): ${health.episodes.map((e) => `${e.smell}/${e.subject}`).join(', ')}` };
  }
  return { status: 'green', reason: 'health watch ticking, no open episodes' };
}

/** @param {object} heavyQueue - `assessHeavyQueue`'s own return shape (`./heavy-queue.mjs`), verbatim. */
export function assessTestQueueSection(heavyQueue) {
  const projected = heavyQueue?.projectedWaitMinutesForNewJob ?? 0;
  const redLine = heavyQueue?.queueAdmission?.maxWaitMinutes ?? QUEUE_YELLOW_FALLBACK_MAX_MINUTES;
  if (projected > redLine) {
    return { status: 'red', reason: `projected wait ~${projected}m exceeds the ${redLine}m admission budget` };
  }
  if (projected > QUEUE_GREEN_MAX_MINUTES) {
    return { status: 'yellow', reason: `projected wait ~${projected}m (over the ${QUEUE_GREEN_MAX_MINUTES}m comfortable bar)` };
  }
  return { status: 'green', reason: `projected wait ~${projected}m, ${heavyQueue?.freeCount ?? 0} slot(s) free` };
}

/** @param {Array<{repoKey:string, free:number, leased:number, dirty:number, total:number, error?:string}>} pools */
export function assessLanesSection(pools) {
  const errored = pools.filter((p) => p.error);
  if (errored.length === pools.length && pools.length > 0) {
    return { status: 'red', reason: `could not read any lane pool: ${errored.map((p) => p.repoKey).join(', ')}` };
  }
  const low = pools.filter((p) => !p.error && p.free <= LANE_FREE_RED_MAX);
  const tight = pools.filter((p) => !p.error && p.free > LANE_FREE_RED_MAX && p.free <= LANE_FREE_YELLOW_MAX);
  if (low.length) return { status: 'red', reason: `no free lanes: ${low.map((p) => p.repoKey).join(', ')}` };
  if (tight.length || errored.length) {
    const bits = [
      ...tight.map((p) => `${p.repoKey} has ${p.free} free`),
      ...errored.map((p) => `${p.repoKey} unreadable: ${p.error}`),
    ];
    return { status: 'yellow', reason: bits.join('; ') };
  }
  return { status: 'green', reason: pools.map((p) => `${p.repoKey}: ${p.free} free / ${p.leased} leased / ${p.dirty} dirty`).join('; ') };
}

/** @param {{lastPass:object|null, error?:string}} drain */
export function assessDrainSection(drain, { now = Date.now() } = {}) {
  if (drain?.error) return { status: 'yellow', reason: `could not read drain history: ${drain.error}` };
  if (!drain?.lastPass) return { status: 'red', reason: 'the drain daemon has never recorded a pass' };
  const ageMs = now - Date.parse(drain.lastPass.at);
  const p = drain.lastPass;
  if (p.exit !== 0) return { status: 'red', reason: `last pass exited ${p.exit}` };
  if (!Number.isFinite(ageMs) || ageMs > DRAIN_STALE_RED_MS) {
    return { status: 'red', reason: `last pass was ${p.at} — the drain may have stopped` };
  }
  if (ageMs > DRAIN_STALE_YELLOW_MS) {
    return { status: 'yellow', reason: `last pass was ${p.at} — later than the ${Math.round(DRAIN_STALE_YELLOW_MS / 60000)}m expected cadence` };
  }
  if ((p.failed ?? 0) > 0) return { status: 'yellow', reason: `last pass had ${p.failed} failure(s)` };
  return { status: 'green', reason: `last pass ${p.at}: considered ${p.considered ?? 0}, merged ${p.merged ?? 0}` };
}

/** @param {{applied:boolean, reason:string, checkedAt?:string}|null} githubAuth */
export function assessGithubAuthSection(githubAuth) {
  if (!githubAuth) return { status: 'red', reason: 'no App auth status ever recorded — nothing has run ensureFreshGithubAppEnv on this host' };
  if (githubAuth.applied) return { status: 'green', reason: `applied (as of ${githubAuth.checkedAt ?? 'unknown time'})` };
  if (githubAuth.reason === 'insufficient-access') {
    return { status: 'red', reason: 'App installation is missing required access — falling back to personal auth' };
  }
  return { status: 'yellow', reason: `not applied (${githubAuth.reason}) — falling back to personal auth` };
}

/** @param {{loadavg:number[], cores:number}} machineLoad */
export function assessMachineLoadSection(machineLoad) {
  const load1 = machineLoad?.loadavg?.[0] ?? 0;
  const cores = machineLoad?.cores || 1;
  const ratio = load1 / cores;
  const reason = `load ${load1.toFixed(2)} over ${cores} core(s) (${ratio.toFixed(2)}x)`;
  if (ratio > LOAD_RED_RATIO) return { status: 'red', reason };
  if (ratio > LOAD_YELLOW_RATIO) return { status: 'yellow', reason };
  return { status: 'green', reason };
}

/**
 * Assess the whole snapshot — one `{status, reason}` per section plus an overall status ({@link worstStatus}
 * of every section). PURE over an already-read snapshot ({@link ./live-state-io.mjs#collectLiveState}'s shape).
 * @param {object} read
 */
export function assessLiveState(read) {
  if (!read || typeof read !== 'object') throw new TypeError('live-state: unreadable snapshot');
  const sections = {
    daemons: assessDaemonsSection(read.daemonStatus),
    health: assessHealthSection(read.health, { now: Date.parse(read.observedAt) }),
    testQueue: assessTestQueueSection(read.heavyQueue),
    lanes: assessLanesSection(read.lanePools),
    drain: assessDrainSection(read.drain, { now: Date.parse(read.observedAt) }),
    githubAuth: assessGithubAuthSection(read.githubAuth),
    machineLoad: assessMachineLoadSection(read.machineLoad),
  };
  const overall = worstStatus(Object.values(sections).map((s) => s.status));
  return {
    observedAt: read.observedAt,
    overall,
    sections,
    // The full already-assessed sub-reports ride along too — a caller that wants the raw daemon rows or the
    // heavy-queue table (the terminal render, a future /wip drill-down) reads them here rather than re-collecting.
    daemonStatus: read.daemonStatus,
    heavyQueue: read.heavyQueue,
    lanePools: read.lanePools,
  };
}

/**
 * The declared operation. Read-only, no input required — same no-sinks reasoning as `daemon-status`/
 * `heavy-queue`: every step is `compute`, so no effect exists for a sink to apply. `collect` is the injected IO
 * ({@link ./live-state-io.mjs#collectLiveState}), bound to every real read ONLY in `run.mjs`.
 * @param {{collect: () => object}} deps
 */
export function liveStateOperation({ collect } = {}) {
  if (typeof collect !== 'function') throw new TypeError('live-state needs a collect reader');
  return op(LIVE_STATE_OP, {
    input: {},
    verdictFrom: 'assess',
    read: compute({ reads: [], fn: () => collect() }),
    assess: compute({ reads: ['findings.read'], fn: ({ findings }) => assessLiveState(findings.read) }),
  });
}
