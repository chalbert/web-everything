/**
 * @file scripts/conveyor/health-smells/duplicate-live-sessions.mjs
 * @description Health smell — dup-heal-dispatch (#x0jphk5 follow-up, epic #3383). LIVE INCIDENT 2026-09-26
 *   22:16 ET: `claude agents --json` showed THREE concurrent `ci-heal-2784` sessions (started ~21, ~14, ~4 min
 *   apart) and THREE `ci-heal-2783` — every dispatched session name
 *   (`we:scripts/conveyor/session-slug.mjs#mintSessionSlug`) is minted for exactly ONE (repo, kind, pr), so
 *   two-or-more LIVE entries sharing one name is never legitimate: it is either the double-dispatch this
 *   epic's own `we:scripts/conveyor/fix-dispatch-claim.mjs` claim exists to prevent (root-caused live tonight:
 *   the claim's OLD `(repo, pr, headSha)` key let a still-working session's own push rotate its claim out from
 *   under it — see that file's own header) or some other double-spawn this repo has not yet named. Either way
 *   it is exactly the BACKSTOP this smell exists to surface, independent of whether the claim fix above
 *   actually catches every future cause.
 *
 *   NON-TERMINAL mirrors `we:scripts/conveyor/health-smells/red-pr-unattended.mjs`'s own exact liveness
 *   convention (`state !== 'done' && state !== 'stopped' && state !== 'failed'`), reused rather than
 *   re-derived — a `done`/`stopped`/`failed` sibling is history, not a live duplicate, and this smell must
 *   never fire on the ordinary "old session finished, new one started" shape.
 *
 *   SHADOW-SAFE BY CONSTRUCTION: this smell only ever REPORTS. It never stops, kills, or otherwise touches any
 *   session — the operator (or the reaper) decides what to do with a live duplicate; see this file's own
 *   `recommendationHint` for why stopping either one here would be exactly the wrong default (#3383's own
 *   hard-won "never kill processes you didn't start" rule).
 *
 *   Notify scope: listed in `we:scripts/conveyor/health-smells-notify-list.mjs`'s `NOTIFY_EVEN_IN_SHADOW` (the
 *   Sun 2026-09-27 ~7:40 AM ET operator decision).
 */

/** Same three terminal states `red-pr-unattended.mjs` already excludes — reused so "live" means the same
 *  thing everywhere this repo asks it. Pure. */
export function isNonTerminal(agent) {
  return agent?.state !== 'done' && agent?.state !== 'stopped' && agent?.state !== 'failed';
}

/**
 * Group LIVE (non-terminal), named agents by `name`; return every group with 2+ members — i.e. every
 * dispatched name currently running more than once. Pure.
 * @param {Array<object>} agents
 * @returns {Array<[string, object[]]>}
 */
export function findDuplicateLiveSessions(agents) {
  const byName = new Map();
  for (const a of Array.isArray(agents) ? agents : []) {
    const name = a && typeof a.name === 'string' ? a.name : '';
    if (!name || !isNonTerminal(a)) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(a);
  }
  return [...byName.entries()].filter(([, list]) => list.length >= 2);
}

export default {
  id: 'duplicate-live-sessions',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['agents'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  recommendationHint: 'Two or more LIVE sessions share one dispatched name — a double-dispatch, never '
    + 'legitimate. Do NOT stop either yourself (#3383: never kill a process you did not start) — report it; '
    + 'the dispatcher\'s claim (we:scripts/conveyor/fix-dispatch-claim.mjs) should never let the same '
    + '(repo, kind, pr) dispatch twice while one copy is still live.',
  evaluate({ agents }) {
    return findDuplicateLiveSessions(agents).map(([name, list]) => ({
      subject: name,
      breach: true,
      measure: {
        name,
        count: list.length,
        sessionIds: list.map((a) => a.sessionId ?? null),
        cwds: list.map((a) => a.cwd ?? null),
        startedAts: list.map((a) => a.startedAt ?? null),
      },
      summary: `${list.length} live sessions are all named "${name}" — a duplicate dispatch under one name.`,
      recommendation: `Do not stop any of "${name}"'s ${list.length} live copies yourself — report it. The `
        + 'dispatcher\'s claim should never let (repo, kind, pr) dispatch twice while one is still live; see '
        + 'we:scripts/conveyor/fix-dispatch-claim.mjs.',
    }));
  },
};
