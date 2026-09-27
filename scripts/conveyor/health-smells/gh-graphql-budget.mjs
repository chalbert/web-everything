/**
 * gh-graphql-budget — the GitHub App installation's hourly GraphQL budget is running out (or already out), with
 * the callers spending it named.
 *
 * Live 2026-09-27: the installation's 6100-points/hour GraphQL bucket hit 0 roughly 30-40 minutes into every
 * hour (measured 05:20-05:27Z: ~145 points/minute, ~8700/hour), freezing landing until the reset — and nothing
 * said so: the drain logged a bare `gh-error`, and the obvious check (`gh api rate_limit`) showed 6059/6100
 * remaining, because the REST endpoint's `graphql` entry is NOT the installation's real GraphQL bucket. This
 * smell reads the bucket the authoritative way (the in-band GraphQL `rateLimit` field, 1 point per tick) plus
 * the throttle's shared budget-block records, and names the top spenders from `calls.jsonl`.
 *
 * Breaches when the sampled `remaining/limit` is below `minRemainingFraction`, or a GraphQL budget block is
 * active (the throttle is already failing calls fast until the reset).
 */
import { MINUTE } from '../health-watch-core.mjs';

/** Rough GraphQL points per logged call, by op — `gh` gives no per-call cost, so this is an ESTIMATE from
 *  `rateLimit(dryRun:true)` measurements (2026-09-27): a full `--limit 100/200` `pr list` with connection
 *  fields costs 2-5, a right-sized snapshot refresh 1, a single-PR read or mutation 1. */
export function estimateGraphqlPoints(e) {
  const op = String(e?.op || '');
  if (!/^(pr|issue|repo|project|search)\b|^api graphql/.test(op)) return 0; // REST — a different bucket
  if (/^pr list \(snapshot\)/.test(op)) return 1;
  if (/^pr list/.test(op) && !/pr-limit/.test(op)) return 3;
  return 1;
}

/** PURE: estimated GraphQL points per caller over the window (only real `call` lines spend; a snapshot hit or a
 *  budget-blocked call sends nothing). */
export function summarizeGraphqlSpend(entries, { now, windowMs = 60 * MINUTE } = {}) {
  const byCaller = {};
  let total = 0;
  let snapshotHits = 0;
  let blocked = 0;
  for (const e of entries || []) {
    const t = Date.parse(e?.ts || '');
    if (!Number.isFinite(t) || now - t > windowMs || t > now + MINUTE) continue;
    if (e.outcome === 'snapshot_hit') { snapshotHits += 1; continue; }
    if (e.outcome === 'budget_blocked') { blocked += 1; continue; }
    if (e.outcome !== 'call') continue;
    const pts = estimateGraphqlPoints(e);
    if (!pts) continue;
    const who = e.caller ? `${e.caller}` : `unattributed ${String(e.op || '?')}`;
    byCaller[who] = (byCaller[who] || 0) + pts;
    total += pts;
  }
  const top = Object.entries(byCaller).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { total, byCaller, top, snapshotHits, blocked };
}

export default {
  id: 'gh-graphql-budget',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['graphqlBudget', 'ghCalls'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'high',
  action: 'alert',
  minRemainingFraction: 0.2,
  recommendationHint: 'the GitHub App GraphQL budget is nearly spent — landing freezes until the hourly reset.',
  evaluate({ graphqlBudget, ghCalls }, { now }) {
    const b = graphqlBudget || {};
    const sample = b.sample || null;
    const block = (b.blocks || []).find((x) => x && x.resource === 'graphql' && Number.isFinite(x.untilMs) && x.untilMs > now) || null;
    const fraction = sample && sample.limit > 0 ? sample.remaining / sample.limit : null;
    const low = fraction != null && fraction < this.minRemainingFraction;
    // Window = the bucket's own hour when the sample names its reset, else the last 60 min.
    const windowMs = sample && Number.isFinite(Date.parse(sample.resetAt))
      ? Math.max(MINUTE, Math.min(60 * MINUTE, now - (Date.parse(sample.resetAt) - 60 * MINUTE)))
      : 60 * MINUTE;
    const spend = summarizeGraphqlSpend(ghCalls, { now, windowMs });
    const used = sample ? sample.limit - sample.remaining : null;
    const unlogged = used != null ? Math.max(0, used - spend.total) : null;
    const topText = spend.top.map(([c, n]) => `${c} ~${n}`).join(', ');
    const breach = !!block || low;
    return [{
      subject: 'graphql-budget',
      breach,
      measure: {
        remaining: sample?.remaining ?? null, limit: sample?.limit ?? null, resetAt: sample?.resetAt ?? null,
        remainingFraction: fraction == null ? null : Math.round(fraction * 1000) / 1000,
        blockedUntil: block?.until ?? null, loggedPointsEstimate: spend.total, unloggedPointsEstimate: unlogged,
        topCallers: Object.fromEntries(spend.top), snapshotHits: spend.snapshotHits, budgetBlockedCalls: spend.blocked,
      },
      summary: `GraphQL budget: ${sample ? `${sample.remaining}/${sample.limit} left, resets ${sample.resetAt}` : 'not sampled'}`
        + `${block ? `; BLOCKED until ${block.until}` : ''}; logged spend ~${spend.total} pts this window`
        + `${unlogged != null ? ` (+~${unlogged} from callers that bypass gh-throttle)` : ''}${topText ? `; top: ${topText}` : ''}.`,
      recommendation: breach
        ? `The App installation's GraphQL budget is ${block ? 'exhausted' : 'nearly exhausted'} — top spenders: ${topText || 'none logged'}`
          + `${unlogged ? `; ~${unlogged} points came from callers that call gh directly (not via gh-throttle), e.g. the drain's merge-ai-prs.mjs` : ''}.`
          + ' Move the heaviest reader onto the shared open-PR snapshot (scripts/lib/pr-snapshot.mjs) or lengthen its interval.'
        : 'ok',
    }];
  },
};
