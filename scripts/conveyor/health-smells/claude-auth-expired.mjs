/**
 * Health smell — LIVE INCIDENT, night of 2026-09-25/26 ET (epic #3383/#4075 continuation). The operator's own
 * Claude login expired; every daemon-dispatched session hit the CLI's own auth failure the instant it ran
 * ("Login expired · Please run /login" — see `we:scripts/conveyor/hung-session.mjs`'s own file header for the
 * exact real transcript shape) and sat dead all night. Nothing alerted the operator: the health watch's own
 * `bad-credentials` sign (`we:scripts/conveyor/health-smells/bad-credentials.mjs`) covers only GitHub's 401s,
 * never a Claude-CLI-side login failure, and (before this card) `notify` was never actually wired to send
 * anything in ANY mode (`we:scripts/conveyor/health-watch.mjs`'s "THE MINIMAL NOTIFY PATH" doc).
 *
 * `notifyEvenInShadow: true` — THE ONE OPT-IN EXCEPTION to shadow mode's blanket notify suppression
 * (`health-watch-core.mjs#planActions`). Every minute this sits unnoticed is another daemon burning a session
 * on a login it cannot use; this is exactly the class of "urgent enough that even the observe-only slice
 * should say something" the plan calls for.
 *
 * `probes: ['authExpired']` — `we:scripts/conveyor/health-watch.mjs#probeAuthExpiredSessions`, which reads
 * every BACKGROUND `claude agents --json` row's own transcript via the shared detector
 * (`hung-session.mjs#readClaudeAuthExpiredInfo` — the SAME one `session-reaper.mjs`'s reap axis and
 * `reconcile-core.mjs`'s liveness mark both use) and returns the ones it flags. Sampled on the same ~15-minute
 * cadence as the `agents`/`prs` probes (a full `claude agents --json` read, not cheap enough for every tick).
 */
import { MINUTE } from '../health-watch-core.mjs';

export default {
  id: 'claude-auth-expired',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['authExpired'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  notifyEvenInShadow: true,
  windowMs: 30 * MINUTE,
  minCount: 2,
  recommendationHint: 'The operator\'s Claude login has expired — run `/login`, then let the daemons redispatch.',
  evaluate({ authExpired }, { now }) {
    const recent = (Array.isArray(authExpired) ? authExpired : [])
      .filter((s) => typeof s?.startedAt === 'number' && now - s.startedAt <= this.windowMs);
    const names = recent.map((s) => s.name).filter(Boolean);
    return [{
      subject: 'claude-auth',
      breach: recent.length >= this.minCount,
      measure: { authExpiredCount30m: recent.length, sessions: names },
      summary: `${recent.length} daemon-dispatched session(s) hit the Claude CLI's own auth failure in the last 30 minutes${names.length ? ` (${names.slice(0, 5).join(', ')}${names.length > 5 ? `, +${names.length - 5} more` : ''})` : ''}.`,
      recommendation: 'Run `/login` (or `claude /login`) to refresh the operator\'s Claude session, then confirm the fix-dispatch/review daemons pick their PRs back up.',
    }];
  },
};
