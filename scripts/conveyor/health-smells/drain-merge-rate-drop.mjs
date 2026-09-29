/**
 * #4068 (slice 3 of #4065) — the drain's merges per hour have dropped while work is waiting. Reads the drain's
 * own `history.jsonl` (each pass's `considered`/`merged`): merges in the last hour against the hourly average of
 * the `baselineMs` before it. A quiet hour with nothing ready is not a drop — so the sign also needs passes in
 * the last hour that considered PRs and landed none of them. 2026-09-24: the drain kept passing but landed
 * little for hours while ready PRs queued, and nothing surfaced it.
 */
import { HOUR } from '../health-watch-core.mjs';

/** PURE: merges in the last `windowMs`, the hourly baseline over the `baselineMs` before it, and the number of
 *  recent passes that considered PRs but landed none. */
export function mergeRate(history, { now, windowMs = HOUR, baselineMs = 6 * HOUR } = {}) {
  const recent = [];
  const base = [];
  for (const p of history || []) {
    const age = now - p.at;
    if (age < 0) continue;
    if (age <= windowMs) recent.push(p);
    else if (age <= windowMs + baselineMs) base.push(p);
  }
  const sum = (xs) => xs.reduce((n, p) => n + (Number(p.merged) || 0), 0);
  const baselineCovered = (history || []).some((p) => now - p.at >= windowMs + baselineMs * 0.9);
  return {
    recentMerged: sum(recent),
    recentPasses: recent.length,
    waitingPasses: recent.filter((p) => (Number(p.considered) || 0) > (Number(p.merged) || 0)).length,
    baselinePerHour: sum(base) / (baselineMs / HOUR),
    baselinePasses: base.length,
    baselineCovered,
  };
}

export default {
  id: 'drain-merge-rate-drop',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['drainHistory'],
  openAfter: 2,
  closeAfter: 2,
  severity: 'medium',
  action: 'investigate',
  windowMs: HOUR,
  baselineMs: 6 * HOUR,
  minBaselinePerHour: 1,
  dropRatio: 0.25,
  minWaitingPasses: 3,
  recommendationHint: 'The drain is landing far fewer PRs per hour than usual while PRs wait — its deferred/failed detail names why.',
  evaluate({ drainHistory }, { now }) {
    if (!Array.isArray(drainHistory)) return [];
    const r = mergeRate(drainHistory, { now, windowMs: this.windowMs, baselineMs: this.baselineMs });
    const expected = r.baselinePerHour * (this.windowMs / HOUR);
    const breach = r.baselineCovered && r.baselinePerHour >= this.minBaselinePerHour
      && r.recentMerged <= expected * this.dropRatio && r.waitingPasses >= this.minWaitingPasses;
    return [{
      subject: 'drain',
      breach,
      measure: { recentMerged: r.recentMerged, baselinePerHour: Math.round(r.baselinePerHour * 10) / 10, recentPasses: r.recentPasses, waitingPasses: r.waitingPasses, baselinePasses: r.baselinePasses, baselineCovered: r.baselineCovered },
      summary: `drain: ${r.recentMerged} merge(s) in the last hour vs ${r.baselinePerHour.toFixed(1)}/h over the prior ${Math.round(this.baselineMs / HOUR)}h; ${r.waitingPasses} of ${r.recentPasses} recent pass(es) considered PRs and landed none.`,
      recommendation: 'Read the drain\'s recent history.jsonl `deferredDetail`/`failedPrs` — a gate every PR now fails (a red required check on main, a review label conflict, an overlap-yield hold) is the usual cause; fix that gate.',
    }];
  },
};
