/**
 * #4068 (slice 3 of #4065) — the resident drain's passes are taking longer than their budget. Every `/drain`
 * pass is recorded in its own `history.jsonl` with its total `ms`; on 2026-09-24 passes ran for many minutes
 * each, so ready PRs waited several pass-lengths to land. Measured over 3,879 live passes (2026-09-29): p50 17s,
 * p90 34s, p99 69s — so a 3-minute budget only trips on a genuinely slow pass, not ordinary variance.
 *
 * Breach: at least `minOver` passes in the last `windowMs` over `budgetMs`, or the latest single pass over
 * `extremeFactor` × budget (one 24-minute pass is itself the headline). The per-step breakdown of a slow pass is
 * in the drain's own log (`pass-timings.mjs`).
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

export default {
  id: 'drain-pass-over-budget',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['drainHistory'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'medium',
  action: 'investigate',
  budgetMs: 3 * MINUTE,
  windowMs: 30 * MINUTE,
  minOver: 2,
  extremeFactor: 3,
  recommendationHint: 'Drain passes run over budget — the per-step timing line in the drain\'s log names the slow step.',
  evaluate({ drainHistory }, { now }) {
    if (!Array.isArray(drainHistory)) return [];
    const recent = drainHistory.filter((p) => now - p.at <= this.windowMs && Number.isFinite(p.ms));
    if (!recent.length) return [];
    const over = recent.filter((p) => p.ms > this.budgetMs);
    const latest = recent.reduce((a, b) => (b.at > a.at ? b : a));
    const maxMs = Math.max(...recent.map((p) => p.ms));
    const extreme = latest.ms > this.budgetMs * this.extremeFactor;
    const breach = over.length >= this.minOver || extreme;
    return [{
      subject: 'drain',
      breach,
      measure: { passes: recent.length, overBudget: over.length, budgetSec: this.budgetMs / 1000, latestSec: Math.round(latest.ms / 1000), maxSec: Math.round(maxMs / 1000) },
      summary: `drain: ${over.length} of ${recent.length} pass(es) in the last ${Math.round(this.windowMs / MINUTE)}m over the ${fmtAge(this.budgetMs)} budget (latest ${fmtAge(latest.ms)}, max ${fmtAge(maxMs)}).`,
      recommendation: 'Read the drain\'s per-step pass-timing line (daemon.log) for the slow step — usually a gh listing under rate-limit backoff, a long rebase, or a gate waiting on a heavy-command slot — and fix that step rather than raising the budget.',
    }];
  },
};
