/**
 * @file scripts/operations/daemon-status.mjs
 * @description #4067 (epic #4075, under #3383) — the declared `daemon-status` operation: one read-only join
 *   of every resident daemon's liveness, last-tick result (including refusal counts), git distance from
 *   `main`, loaded overlays, and recent rebuild alerts, so "a daemon that is alive but refusing everything" is
 *   visible at a glance instead of requiring someone to tail four different logs by hand.
 *
 * READ / ASSESS SPLIT (mirrors `runner-activity.mjs`, the closest existing analog): {@link
 * ./daemon-status-io.mjs}'s `collectDaemonStatus` does every real read (launchd, lease files, logs,
 * `state.json`, the overlay list, the rebuild daemon's own per-clone state + alert trail, a fetch-free git
 * distance check); {@link assessDaemonStatus} is a pure function over that raw snapshot that decides, per
 * daemon, one of four states:
 *
 *   - `down`            — no running launchd pid.
 *   - `alive-and-stalled` — running, but its lease heartbeat (where it has one) is older than the lease
 *                         window — the SAME staleness definition `runner-activity.mjs#assessDaemonState`
 *                         already uses, so "stalled" means the same thing everywhere this repo says it.
 *   - `alive-and-refusing` — running, heartbeat fresh, and its last tick ATTEMPTED something but SUCCEEDED
 *                         at none of it (`attempted > 0 && succeeded === 0 && refused > 0`) — the exact
 *                         "alive but refusing everything" case this card exists to surface.
 *   - `alive`            — running, heartbeat fresh, nothing alarming in the last tick (including a daemon
 *                         with no dispatch/refusal concept of its own, e.g. a read-only watch pass).
 *
 * Independently of that state, `hasRecentAlerts`/`recentAlertKinds` (from the rebuild daemon's own
 * `<cloneKey>.alerts.jsonl` trail — `smoke-rejected`, `clone-held-stale`, etc.) ride on EVERY daemon's headline
 * regardless of its state: an `alive` daemon whose clone is being held off `main` by a rejected smoke is
 * exactly the "looks fine, doing nothing useful" case a bare state enum would hide.
 *
 * `attempted`/`succeeded`/`refused` are a single normalized shape the IO layer already reduces every daemon
 * family's own vocabulary into (`dispatched`/`refused` for the fix-dispatch daemon, `owed`/`dispatched`/
 * `failed` for the review daemon, `considered`/`merged`/deferred+skipped for the drain daemon) — see that
 * file's own parse functions. A daemon with no such concept (most `pass-daemon.mjs` watches) reports
 * `tick.found: false` and is never treated as "refusing" for lack of a concept it doesn't have.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const DAEMON_STATUS_OP = 'daemon-status';

/** How old a lease heartbeat may be before a running daemon counts as stalled rather than idle/refusing —
 *  matches `runner-activity-io.mjs`'s own lease TTL expectation (a daemon heartbeats well inside this). */
export const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Assess ONE daemon's raw snapshot (see {@link ./daemon-status-io.mjs}'s `collectOneDaemon` for the input
 * shape). Pure — every input is already read; this only classifies it.
 * @param {object} raw
 * @param {{observedAt:string, staleAfterMs?:number}} ctx
 */
export function assessDaemonEntry(raw, { observedAt, staleAfterMs = DEFAULT_STALE_AFTER_MS } = {}) {
  // Recent rebuild alerts (`smoke-rejected`, `clone-held-stale`, …) are read regardless of the daemon's own
  // running/tick state — a daemon that LOOKS fine but whose clone is being held off `main` by the rebuild is
  // exactly the "alive but doing nothing useful" case this card exists to surface at a glance, so the most
  // recent alert kind rides on the headline in every branch below, not just the refusing one.
  const recentAlertKinds = Array.isArray(raw?.recentAlerts?.alerts) ? raw.recentAlerts.alerts.map((a) => a.kind) : [];
  const hasRecentAlerts = recentAlertKinds.length > 0;
  const alertSuffix = hasRecentAlerts ? ` — recent rebuild alert: ${recentAlertKinds[recentAlertKinds.length - 1]}` : '';

  if (!raw || raw.readable === false) {
    return { ...raw, state: 'unreadable', refusing: false, hasRecentAlerts, recentAlertKinds, headline: "this daemon's launchd plist could not be read" + alertSuffix };
  }
  if (!raw.running) {
    return { ...raw, state: 'down', refusing: false, hasRecentAlerts, recentAlertKinds, headline: 'not running (no launchd pid)' + alertSuffix };
  }

  const heartbeatAt = raw.lease?.entry?.heartbeatAt ?? null;
  const heartbeatAgeMs = heartbeatAt ? Date.parse(observedAt) - Date.parse(heartbeatAt) : null;
  // A daemon family with no lease of its own (the drain daemon) is never judged stale on a heartbeat it was
  // never going to have; it is judged on its own tick's `at` instead, when one is known. A daemon with
  // NEITHER (a lease-bearing kind whose lease file is missing/corrupt) fails CLOSED — an unreadable
  // heartbeat is treated as stale, never as "fine", mirroring `runner-activity.mjs#assessDaemonState`'s own
  // `!Number.isFinite(heartbeatAge)` handling.
  const tickAt = raw.tick?.at ?? null;
  const tickAgeMs = tickAt ? Date.parse(observedAt) - Date.parse(tickAt) : null;
  const stale = raw.leaseKey != null
    ? (heartbeatAgeMs == null || !Number.isFinite(heartbeatAgeMs) || heartbeatAgeMs > staleAfterMs)
    : (tickAt != null && Number.isFinite(tickAgeMs) && tickAgeMs > staleAfterMs);

  const t = raw.tick ?? { found: false };
  const attempted = t.found && !t.tickFailed ? t.attempted ?? null : null;
  const succeeded = t.found && !t.tickFailed ? t.succeeded ?? null : null;
  const refused = t.found && !t.tickFailed ? t.refused ?? null : null;
  const tickFailed = !!t.tickFailed;
  const refusing = !stale && !tickFailed && attempted != null && attempted > 0 && succeeded === 0 && refused > 0;

  let state = 'alive';
  let headline = 'running, no dispatch/refusal concept for this daemon';
  if (stale) { state = 'alive-and-stalled'; headline = 'running, but its heartbeat/tick is older than the stale window'; }
  else if (tickFailed) { state = 'alive-and-stalled'; headline = `running, but its last tick threw: ${t.error}`; }
  else if (refusing) { state = 'alive-and-refusing'; headline = `running, but refused all ${refused} of ${attempted} attempted this tick`; }
  else if (t.found) { headline = `running, last tick: ${succeeded ?? 0} succeeded, ${refused ?? 0} refused of ${attempted ?? 0} attempted`; }

  return {
    ...raw, state, refusing, hasRecentAlerts, recentAlertKinds, headline: headline + alertSuffix,
    lastTickAt: heartbeatAt ?? tickAt ?? null,
    lastTickAtSource: heartbeatAt ? 'lease-heartbeat' : tickAt ? 'tick-timestamp' : null,
    attempted, succeeded, refused,
  };
}

/**
 * Assess the whole snapshot. Adds one top-level `anyRefusing`/`refusingDaemons` summary so a caller (the
 * terminal render, the future /wip panel) can headline "N daemons refusing everything" without re-scanning
 * the per-daemon rows itself.
 */
export function assessDaemonStatus(read) {
  if (!read || !Array.isArray(read.daemons)) {
    throw new TypeError('daemon-status: unreadable snapshot has no daemons array');
  }
  const daemons = read.daemons.map((raw) => assessDaemonEntry(raw, { observedAt: read.observedAt }));
  const refusingDaemons = daemons.filter((d) => d.refusing).map((d) => d.name);
  const downDaemons = daemons.filter((d) => d.state === 'down').map((d) => d.name);
  const staleDaemons = daemons.filter((d) => d.state === 'alive-and-stalled').map((d) => d.name);
  const alertingDaemons = daemons.filter((d) => d.hasRecentAlerts).map((d) => d.name);
  return {
    observedAt: read.observedAt, daemons,
    anyRefusing: refusingDaemons.length > 0, refusingDaemons,
    anyDown: downDaemons.length > 0, downDaemons,
    anyStalled: staleDaemons.length > 0, staleDaemons,
    anyRecentAlerts: alertingDaemons.length > 0, alertingDaemons,
  };
}

/**
 * The declared operation. Read-only, no input required — `collect` is the injected IO
 * ({@link ./daemon-status-io.mjs#collectDaemonStatus}), so the CLI wiring (`run.mjs`) is the only place a
 * real launchd/filesystem dependency is ever bound.
 * @param {{collect: () => object}} deps
 */
export function daemonStatusOperation({ collect } = {}) {
  if (typeof collect !== 'function') throw new TypeError('daemon-status needs a collect reader');
  return op(DAEMON_STATUS_OP, {
    input: {},
    verdictFrom: 'assess',
    read: compute({ reads: [], fn: () => collect() }),
    assess: compute({ reads: ['findings.read'], fn: ({ findings }) => assessDaemonStatus(findings.read) }),
  });
}
