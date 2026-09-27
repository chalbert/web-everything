/**
 * drain-failing-repeatedly — the DRAIN ITSELF (not the host-wide `gh` aggregate `gh-call-failures` already
 * covers) is failing pass after pass: a run of consecutive `gh` calls made BY the drain's own scripts
 * (`merge-ai-prs.mjs`, `pr-land.mjs` — the same `calls.jsonl` `caller` attribution `gh-call-failures.mjs`'s
 * `writesByCaller` already reads, via `we:scripts/lib/gh-throttle.mjs#deriveGhCaller`'s free
 * `process.argv[1]`-basename attribution) all fail.
 *
 * Live 2026-09-27 ~04:04-04:33Z: during the GraphQL-budget/rate-limit freeze `gh-call-failures.mjs` and
 * `gh-graphql-budget.mjs` both name (host-wide signals — ANY caller, ANY op), the drain specifically failed
 * every pass with a bare `gh-error` for the whole window — a distinct, narrower signal from either: it answers
 * "is the LANDER itself stuck", not "is GitHub rate-limiting somebody" (a host could be rate-limited on a
 * read-only caller while the drain still lands fine, and vice versa a drain-only auth/permission problem would
 * never trip the host-wide ratio). A STREAK (consecutive failures, not a windowed ratio) is the right shape
 * here: the drain runs its pass every few minutes regardless of load, so N drain calls in a row failing is
 * itself the "pass-failed" signal, independent of how many other callers succeeded in between.
 */
import { MINUTE } from '../health-watch-core.mjs';

/** `process.argv[1]` basenames the drain's own scripts run as (`deriveGhCaller`'s free attribution). */
export const DRAIN_CALLERS = Object.freeze(new Set(['merge-ai-prs.mjs', 'pr-land.mjs']));

/** PURE: the trailing run of consecutive FAILED `gh` calls attributed to a drain caller, most-recent-first,
 *  within `windowMs` of `now` — resets the instant a drain call in the window succeeds. */
export function drainFailureStreak(entries, { now, windowMs = 30 * MINUTE } = {}) {
  const drainCalls = (entries || [])
    .filter((e) => e?.outcome === 'call' && DRAIN_CALLERS.has(e?.caller))
    .map((e) => ({ ...e, at: Date.parse(e?.ts || '') }))
    .filter((e) => Number.isFinite(e.at) && now - e.at <= windowMs && e.at <= now + MINUTE)
    .sort((a, b) => b.at - a.at); // most recent first
  let streak = 0;
  let since = null;
  let lastReason = null;
  for (const e of drainCalls) {
    if (e.ok !== false) break; // a success ends the streak
    streak += 1;
    since = e.at;
    lastReason = lastReason ?? e.op ?? null;
  }
  return { streak, since, lastReason, sampled: drainCalls.length };
}

export default {
  id: 'drain-failing-repeatedly',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['ghCalls'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'high',
  action: 'alert',
  windowMs: 30 * MINUTE,
  minStreak: 5,
  recommendationHint: 'The drain\'s own gh calls (merge-ai-prs.mjs / pr-land.mjs) are failing pass after pass — read the drain\'s own log tail for the exact reason (gh-error, auth, rate-limit); this is the lander itself stuck, not just host-wide gh noise.',
  evaluate({ ghCalls }, { now }) {
    const s = drainFailureStreak(ghCalls, { now, windowMs: this.windowMs });
    const breach = s.streak >= this.minStreak;
    return [{
      subject: 'drain',
      breach,
      measure: { streak: s.streak, sampledDrainCalls: s.sampled, lastReason: s.lastReason, sinceAgeMin: s.since == null ? null : Math.round((now - s.since) / MINUTE) },
      summary: `drain: ${s.streak} consecutive failed gh call(s) (of ${s.sampled} sampled in ${Math.round(this.windowMs / MINUTE)}m)${s.lastReason ? ` — last op "${s.lastReason}"` : ''}.`,
      recommendation: this.recommendationHint,
    }];
  },
};
