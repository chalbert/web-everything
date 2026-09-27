/**
 * pr-events-stale — a daemon has the webhook-driven wake ON (`WE_PR_EVENTS=1`, `we:scripts/lib/pr-events.mjs`)
 * but the PR-events feed is not doing its job, so that daemon has silently fallen back to plain interval polling.
 *
 * Two independent signals, both from data this tick already has:
 *   • UNREACHABLE — the waker's own status file says its last poll of the Worker failed (bad token, Worker down,
 *     DNS). The daemon is back on its 2-min base interval; the GraphQL budget pressure the feed removes is back.
 *   • MISSED ACTIVITY — an open PR's newest check completed well after the feed's last delivery. GitHub sends
 *     `check_run.completed` for every check, so this means deliveries are not arriving (webhook deleted/disabled,
 *     secret rotated on one side only, a repo never got the webhook). This is the precise "stale" test: a feed
 *     that is merely QUIET (no PR activity overnight) does not breach, because no check completed either.
 *
 * Runs on the `gh` cadence because the missed-activity check needs the open-PR sample (`probes.prs`). A status
 * file older than `ignoreStatusOlderThanMs` belongs to a daemon that stopped polling (restarted with the flag
 * off, or dead — `daemon-silent` owns that), so it is ignored rather than alarmed on forever.
 */
import { MINUTE } from '../health-watch-core.mjs';

/** PURE: newest `completedAt` across open PRs' check rollups, optionally limited to `repos`. */
export function newestCheckCompletion(prs, repos = null) {
  let best = null;
  for (const pr of prs || []) {
    if (Array.isArray(repos) && repos.length && !repos.includes(pr.repo)) continue;
    for (const c of pr.statusCheckRollup || []) {
      const t = Date.parse(c?.completedAt || '');
      if (Number.isFinite(t) && (best == null || t > best.at)) best = { at: t, repo: pr.repo, number: pr.number, name: c.name };
    }
  }
  return best;
}

export default {
  id: 'pr-events-stale',
  scope: 'host',
  cadence: 'gh',
  probes: ['prEventsStatus', 'prs'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'medium',
  action: 'alert',
  missedGraceMs: 15 * MINUTE,
  ignoreStatusOlderThanMs: 30 * MINUTE,
  recommendationHint: 'the webhook PR-events feed is unreachable or missing deliveries — daemons fell back to polling.',
  evaluate({ prEventsStatus, prs }, { now }) {
    const out = [];
    for (const s of prEventsStatus || []) {
      if (!s || typeof s.role !== 'string') continue;
      const age = Number.isFinite(s.updatedAt) ? now - s.updatedAt : Infinity;
      const subject = `pr-events:${s.role}`;
      if (age > this.ignoreStatusOlderThanMs) {
        out.push({ subject, breach: false, measure: { health: s.health, statusAgeMs: age }, summary: `${s.role}: pr-events status is old (${Math.round(age / MINUTE)} min) — daemon not polling the feed; ignored`, recommendation: 'ok' });
        continue;
      }
      const newest = newestCheckCompletion(prs, Array.isArray(s.repos) ? s.repos : null);
      const lastDelivery = Number.isFinite(s.lastDeliveryAt) ? s.lastDeliveryAt : null;
      const missed = newest != null && (lastDelivery == null || newest.at - lastDelivery > this.missedGraceMs);
      const unreachable = s.health === 'unreachable';
      const breach = unreachable || missed;
      const lastDeliveryText = lastDelivery ? new Date(lastDelivery).toISOString() : 'never';
      out.push({
        subject,
        breach,
        measure: {
          health: s.health, lastError: s.lastError ?? null, lastDeliveryAt: lastDeliveryText,
          newestCheckCompletedAt: newest ? new Date(newest.at).toISOString() : null,
          newestCheck: newest ? `${newest.repo}#${newest.number} ${newest.name}` : null,
          effectiveIntervalMs: s.effectiveIntervalMs ?? null,
        },
        summary: `${s.role}: pr-events feed ${s.health}${unreachable && s.lastError ? ` (${s.lastError})` : ''}; last delivery ${lastDeliveryText}`
          + `${missed ? `; MISSED — ${newest.repo}#${newest.number} check "${newest.name}" completed ${new Date(newest.at).toISOString()} with no delivery since` : ''}.`,
        recommendation: !breach ? 'ok'
          : unreachable
            ? `The ${s.role} daemon cannot read the PR-events Worker (${s.lastError || 'unknown error'}) and is back on interval polling. Check WE_PR_EVENTS_URL / the read-token file against the Worker's PR_EVENTS_READ_TOKEN secret, and that the Worker is deployed.`
            : `GitHub deliveries are not reaching the PR-events Worker (a check completed after the last delivery). In the repo's Settings → Webhooks, open the PR-events webhook's "Recent Deliveries": a red delivery names the cause (secret mismatch → 401, Worker down → 5xx); a missing webhook on ${newest.repo} means it was never added there.`,
      });
    }
    return out;
  },
};
