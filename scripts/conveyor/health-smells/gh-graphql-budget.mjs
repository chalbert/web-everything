/**
 * gh-graphql-budget — the GitHub App installation's hourly GraphQL budget is running out (or already out), with
 * the callers spending it named.
 *
 * Live 2026-09-27: the installation's 6100-points/hour GraphQL bucket hit 0 roughly 30-40 minutes into every
 * hour (measured 05:20-05:27Z: ~145 points/minute, ~8700/hour), freezing landing until the reset — and nothing
 * said so: the drain logged a bare `gh-error`, and the obvious check (`gh api rate_limit`) showed 6059/6100
 * remaining, because the REST endpoint's `graphql` entry is NOT the installation's real GraphQL bucket. This
 * smell reads the bucket the authoritative way (the in-band GraphQL `rateLimit` field, 1 point per tick) plus
 * the throttle's shared budget-block records, and names the top spenders from `calls.jsonl` — with points
 * attributed from GitHub's own `X-Ratelimit-Used` headers where the call line carries them (#4309,
 * `we:scripts/lib/gh-spend.mjs`), and a learned per-op estimate otherwise.
 *
 * Breaches when the sampled `remaining/limit` is below `minRemainingFraction`, or a GraphQL budget block is
 * active (the throttle is already failing calls fast until the reset).
 */
import { MINUTE } from '../health-watch-core.mjs';
import { attributeSpend, estimateGraphqlPoints, staticPointsEstimate } from '../../lib/gh-spend.mjs';

/** The static per-op GraphQL estimate now lives with the spend accounting (#4309); re-exported for callers. */
export { estimateGraphqlPoints };

/** PURE: GraphQL points per caller over the window (#4309). A caller's points are ATTRIBUTED (from the free
 *  `X-Ratelimit-Used` headers the throttle passthrough logs in `rl`) where its calls carry them, and the learned
 *  per-op ESTIMATE otherwise (`estimate: true`). Only real `call` lines spend; a snapshot hit or a budget-blocked
 *  call sends nothing. `attributed + estimated + unattributed` is the bucket's observed `used` change. */
export function summarizeGraphqlSpend(entries, { now, windowMs = 60 * MINUTE } = {}) {
  let snapshotHits = 0;
  let blocked = 0;
  const inWindow = [];
  for (const e of entries || []) {
    const t = Date.parse(e?.ts || '');
    if (!Number.isFinite(t) || now - t > windowMs || t > now + MINUTE) continue;
    if (e.outcome === 'snapshot_hit') { snapshotHits += 1; continue; }
    if (e.outcome === 'budget_blocked') { blocked += 1; continue; }
    if (e.outcome === 'call') inWindow.push(e);
  }
  const { invocations, gaps } = attributeSpend(inWindow, { now });
  // Keyed by the log's own caller names — no prototype, so `__proto__` is an ordinary key (PR #2851 review).
  const callers = Object.create(null);
  const ops = Object.create(null);
  let unknownInvocations = 0;
  let unknownRaw = 0;
  for (const inv of invocations) {
    const attributed = inv.attributedByRes.graphql || 0;
    const onGraphql = inv.resource === 'graphql';
    let estimated = 0;
    if (onGraphql && inv.kind === 'estimated') estimated = inv.estimated;
    if (onGraphql && inv.kind === 'unknown') {
      estimated = inv.measured ? staticPointsEstimate(inv, 'graphql') : inv.estimateRaw;
      unknownInvocations += 1;
      unknownRaw += estimated;
    }
    const pts = attributed + estimated;
    if (!pts && !(onGraphql && inv.kind === 'attributed')) continue;
    for (const [map, key] of [[callers, inv.caller], [ops, `${inv.caller} ${inv.op}`]]) {
      const c = map[key] || (map[key] = { points: 0, estimate: false, requests: 0 });
      c.points += pts;
      c.requests += 1;
      if (estimated) c.estimate = true;
    }
  }
  const rank = (m) => Object.entries(m).sort((a, b) => b[1].points - a[1].points || b[1].requests - a[1].requests);
  const round = (n) => Math.round(n * 10) / 10;
  const sum = (k) => round(gaps.filter((g) => g.res === 'graphql').reduce((s, g) => s + g[k], 0));
  const attributed = sum('attributed');
  const estimated = sum('estimated');
  const unknownEstimated = round(unknownRaw);
  // `total` = what the callers were charged = attributed + estimated + the unknown calls' own fallback estimate.
  // Built from the ROUNDED parts, so the summary's breakdown always adds up to it exactly (PR #2851 review).
  const total = round(attributed + estimated + unknownEstimated);
  const byCaller = Object.fromEntries(rank(callers).map(([k, c]) => [k, round(c.points)]));
  const top = rank(callers).slice(0, 5).map(([k, c]) => [k, round(c.points)]);
  const topOps = rank(ops).slice(0, 5).map(([k, c]) => ({ name: k, points: round(c.points), estimate: c.estimate, requests: c.requests }));
  const topCallers = rank(callers).slice(0, 5).map(([k, c]) => ({ name: k, points: round(c.points), estimate: c.estimate, requests: c.requests }));
  return {
    total, byCaller, top, topCallers, topOps, snapshotHits, blocked, unknownInvocations,
    attributed, estimated, unknownEstimated, unattributed: sum('unattributed'),
  };
}

/** `name ~N pts/R req` — `~` marks a caller whose points include an estimate (attributed points are themselves a
 *  delta-based reconstruction, see gh-spend.mjs, but they come from GitHub's own counter). */
function describeCaller(c) {
  return `${c.name} ${c.estimate ? '~' : ''}${c.points} pts/${c.requests} req`;
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
    const topText = spend.topCallers.slice(0, 3).map(describeCaller).join(', ');
    const breach = !!block || low;
    return [{
      subject: 'graphql-budget',
      breach,
      measure: {
        remaining: sample?.remaining ?? null, limit: sample?.limit ?? null, resetAt: sample?.resetAt ?? null,
        remainingFraction: fraction == null ? null : Math.round(fraction * 1000) / 1000,
        blockedUntil: block?.until ?? null, loggedPointsEstimate: spend.total, unloggedPointsEstimate: unlogged,
        topCallers: Object.fromEntries(spend.top), snapshotHits: spend.snapshotHits, budgetBlockedCalls: spend.blocked,
        attributed: spend.attributed, estimated: spend.estimated, unknownEstimated: spend.unknownEstimated,
        unattributed: spend.unattributed, unknownInvocations: spend.unknownInvocations, topOps: spend.topOps,
      },
      // The breakdown adds up to the total; `unattributed` is bucket change NO logged call was charged, so it is
      // reported beside the total, never inside it (PR #2851 review).
      summary: `GraphQL budget: ${sample ? `${sample.remaining}/${sample.limit} left, resets ${sample.resetAt}` : 'not sampled'}`
        + `${block ? `; BLOCKED until ${block.until}` : ''}; logged spend ~${spend.total} pts this window`
        + ` (header-attributed ${spend.attributed} + estimated ${spend.estimated} + unknown-call estimate ${spend.unknownEstimated};`
        + ` a further ${spend.unattributed} observed but unattributed)`
        + `${unlogged != null ? ` (+~${unlogged} from callers that bypass gh-throttle)` : ''}${topText ? `; top: ${topText}` : ''}.`,
      recommendation: breach
        ? `The App installation's GraphQL budget is ${block ? 'exhausted' : 'nearly exhausted'} — top spenders: ${topText || 'none logged'}`
          + `${unlogged ? `; ~${unlogged} points came from callers that call gh directly (not via gh-throttle), e.g. the drain's merge-ai-prs.mjs` : ''}.`
          + ' (Header-attributed points are delta-based estimates from X-Ratelimit-Used and can include bypass traffic; `~` marks per-op estimates.)'
          + ' Move the heaviest reader onto the shared open-PR snapshot (scripts/lib/pr-snapshot.mjs) or lengthen its interval.'
        : 'ok',
    }];
  },
};
