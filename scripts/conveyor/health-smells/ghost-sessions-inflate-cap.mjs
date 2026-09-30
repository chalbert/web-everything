/**
 * @file scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs
 * @description Health smell — ghost-sessions-inflate-cap (#ghost-sessions-inflate-cap). LIVE INCIDENT
 *   2026-09-27: `claude agents --json` listed 18 `conveyor-NNNN` sessions, every one `state:'working'`, 20-26
 *   days old — every one with a confirmed-dead process (no matching `pid`/`ps aux` entry at all). None had
 *   ever been reaped: `we:scripts/conveyor/session-reaper.mjs` only reaps a session whose `cwd` matches
 *   whichever daemon's own `allowedCwd` is scanning, and every one of these 18 was dispatched from a DIFFERENT
 *   checkout than whichever daemon last looked (see that file's own `pid-dead` axis, added alongside this
 *   smell, for the actual fix).
 *
 *   THIS SMELL IS OBSERVABILITY, NOT THE FIX. It never reaps, stops, or touches anything — same "shadow-safe
 *   by construction" contract `duplicate-live-sessions.mjs` states for itself (#3383: never kill a process you
 *   did not start). Its job is to make a listing full of long-dead entries VISIBLE — as a distinct signal from
 *   `duplicate-live-sessions.mjs` (which flags the SAME name live twice) and from the reaper's own pass (which
 *   only reports what it actually stopped, not what it is choosing to leave alone this tick, e.g. because
 *   `session-reaper.mjs` is invoked with `pidDeadFor` still off somewhere, or is simply due to run later).
 *
 *   NAME NOTE: despite the name (chosen to match the live incident's own framing), this smell does NOT itself
 *   assert that these ghosts inflate any particular concurrency cap — investigating the actual capacity-cap
 *   mechanism (`scripts/conveyor/tick-core.mjs#planTick`'s `capToConcurrency`) found it counts LEASED LANES
 *   (`scripts/lane-pool.mjs`'s own TTL-based lease, not `claude agents --json` session state at all), so a
 *   ghost agent-listing entry with no current lane lease does not, by itself, inflate that specific cap. What
 *   is real and worth surfacing regardless: a long-dead entry sitting in the listing as `state:'working'` is
 *   noise that inflates every OTHER count/report that trusts `state` without a liveness check (this smell's
 *   own `measure.count`, `duplicate-live-sessions.mjs`'s own group sizes, an operator's own `claude agents`
 *   read) — hence the smell, kept under the name the operator asked for.
 */

/** Same three terminal states this repo's other agent-listing smells already exclude (`duplicate-live-
 *  sessions.mjs#isNonTerminal`, `red-pr-unattended.mjs`) — reused rather than re-derived. */
function isNonTerminal(agent) {
  return agent?.state !== 'done' && agent?.state !== 'stopped' && agent?.state !== 'failed';
}

/**
 * Whether ANY row in a parsed `ps` snapshot (`health-watch.mjs#probeProcesses`'s own shape — `{pid, command,
 * ...}` rows) corroborates this session's own process is still alive: the row's own `pid` when present, else a
 * scan for the row's full `sessionId` inside any process's command line (a `--resume=<uuid>` invocation) —
 * the SAME two-signal shape `driver-watchdog.mjs#resolvePidAlive` uses over a raw `ps aux` string, adapted to
 * `probeProcesses`'s already-parsed rows so this smell needs no probe of its own beyond the ones `health-
 * watch.mjs` already wires for `machine-overload`. `null` (never a guess) when neither signal can answer.
 * @param {object} session
 * @param {Array<{pid?:number, command?:string}>} processRows
 * @returns {boolean|null}
 */
export function isProcessAlive(session, processRows) {
  const pid = Number(session?.pid);
  const rowsGiven = Array.isArray(processRows);
  // An unavailable snapshot is "unknown" (`null`), never "confirmed dead" — same as the sessionId branch below.
  if (Number.isInteger(pid) && pid > 0) return rowsGiven ? processRows.some((p) => Number(p?.pid) === pid) : null;
  const sid = session?.sessionId ? String(session.sessionId) : '';
  // `!rowsGiven` (the probe itself never ran/failed) is "unknown" — a successfully-read but genuinely EMPTY
  // snapshot (`[]`, no rows at all) is a definite "not found" via `.some()` on an empty array, same as
  // `resolvePidAlive`'s own `''.includes(sid)` reading a successfully-read-but-empty raw string as `false`,
  // never `null` — the two must not collapse, or a real "nothing is running" reading would be silently
  // downgraded to "we don't know".
  if (!sid || !rowsGiven) return null;
  return processRows.some((p) => typeof p?.command === 'string' && p.command.includes(sid));
}

/**
 * Every NON-TERMINAL (`state !== done|stopped|failed`) session whose own process is CONFIRMED gone. Pure.
 * @param {Array<object>} agents
 * @param {Array<object>} processRows
 * @returns {object[]}
 */
export function findGhostAgentSessions(agents, processRows) {
  const list = Array.isArray(agents) ? agents : [];
  return list.filter((a) => isNonTerminal(a) && isProcessAlive(a, processRows) === false);
}

export default {
  id: 'ghost-sessions-inflate-cap',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['agents', 'processes'],
  // Hysteresis wider than `duplicate-live-sessions.mjs`'s (1/1): a ghost is not an acute incident the way a
  // double-dispatch is — it costs noise, not correctness — so this waits for 3 consecutive confirmations
  // before opening (a single `ps` scan racing a process's own exit is not worth alerting on) and 1 to close
  // (once genuinely gone, it's gone).
  openAfter: 3,
  closeAfter: 1,
  severity: 'medium',
  action: 'alert',
  recommendationHint: 'One or more `claude agents --json` entries are confirmed dead (no matching pid, no '
    + 'matching ps command line) but still listed non-terminal. Do NOT `claude stop` them by hand — run '
    + 'session-reaper.mjs (or the daemon that already owns it, we:skills-src/conveyor/review-daemon.mjs) with '
    + 'its pid-dead axis on; that is the sanctioned reap path.',
  evaluate({ agents, processes }) {
    const ghosts = findGhostAgentSessions(agents, processes);
    if (!ghosts.length) return [];
    return [{
      subject: 'agents-listing',
      breach: true,
      measure: {
        count: ghosts.length,
        names: ghosts.map((g) => g.name ?? null),
        oldestStartedAt: ghosts.reduce((min, g) => (
          typeof g.startedAt === 'number' && (min == null || g.startedAt < min) ? g.startedAt : min
        ), null),
      },
      summary: `${ghosts.length} agent-listing session(s) are confirmed dead (no pid, no ps match) but still `
        + 'read non-terminal.',
      recommendation: 'Run the session reaper with its pid-dead axis on (session-reaper.mjs#makePidDeadResolver) '
        + 'rather than `claude stop`-ing these by hand.',
    }];
  },
};
