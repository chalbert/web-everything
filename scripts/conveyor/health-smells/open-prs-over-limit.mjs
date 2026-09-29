/**
 * Seed smell 9 / #4066 — open, not-yet-`review:accepted` PRs ABOVE the open-PR backpressure limit
 * (`we:scripts/lib/pr-limit.mjs`, we:xniq7xs / x55tmjy). At the limit, pr-land refuses new opens and dispatch
 * intake holds: the limit is working. ABOVE it means PRs got past it (exempt infra changesets, per-branch allows,
 * `--force-open`) and the review backlog is still growing — the review system is the bottleneck.
 *
 * The limit and the override state are the backpressure module's own: the `prLimit` probe reads
 * `resolvePrLimit` per repo and `isGlobalOffNow(readLimitState())`. While the operator has the limit globally
 * OFF, being over it is expected and never breaches.
 *
 * The COUNT is a cheap upper bound off the shared open-PR snapshot: every open PR not `review:accepted`.
 * pr-limit's own count also requires AI authorship, which costs one `gh pr view --json commits` per PR (a bulk
 * commits read blows GitHub's node limit — see `fetchPrCommits`); that is too many calls for a 15-minute probe.
 * So the exact count is the deterministic diagnosis instead (`pr-limit.mjs status`), run once when an episode
 * opens. In this fleet nearly every open PR is agent-authored, so the bound is close.
 */
import { repoKeyForSlug } from '../../lib/constellation-repos.mjs';
import { REVIEW_LABELS } from '../../lib/review-escalation.mjs';

const hasLabel = (pr, name) => (pr?.labels || []).some((l) => (typeof l === 'string' ? l : l?.name) === name);

export default {
  id: 'open-prs-over-limit',
  scope: 'repo',
  cadence: 'gh',
  probes: ['prs', 'prLimit'],
  openAfter: 2,
  closeAfter: 2,
  severity: 'medium',
  action: 'alert',
  diagnose: { command: 'node', args: ['scripts/operations/pr-limit.mjs', 'status'], timeoutMs: 60_000 },
  recommendationHint: 'More open unaccepted PRs than the backpressure limit allows — reviews are not keeping up.',
  evaluate({ prs, prLimit }) {
    const limits = prLimit?.limits || {};
    const byRepo = new Map();
    for (const pr of prs || []) {
      const key = repoKeyForSlug(pr.repo) ?? pr.repo;
      if (!byRepo.has(key)) byRepo.set(key, { slug: pr.repo, open: 0, unaccepted: [] });
      const r = byRepo.get(key);
      r.open += 1;
      if (!hasLabel(pr, REVIEW_LABELS.accepted)) r.unaccepted.push(pr.number);
    }
    const out = [];
    for (const [key, r] of byRepo) {
      const limit = limits[key];
      if (!Number.isFinite(limit)) continue; // a repo the limit does not know is never capped (resolvePrLimit → Infinity)
      const count = r.unaccepted.length;
      const over = count > limit;
      const breach = over && prLimit?.globalOff !== true;
      out.push({
        subject: r.slug,
        breach,
        measure: { repo: key, unaccepted: count, limit, open: r.open, globalOff: prLimit?.globalOff === true, countIsUpperBound: true },
        summary: `${r.slug}: ${count} open PR(s) not review:accepted vs limit ${limit}`
          + `${prLimit?.globalOff ? ' (limit globally OFF by operator override)' : ''} (upper bound — authorship not checked).`,
        recommendation: !breach
          ? (over ? 'Over the limit, but the operator turned the limit off — expected.' : 'ok')
          : `${count - limit} PR(s) over the ${key} limit of ${limit}: the review pipeline is not keeping up. Review or land the oldest `
            + 'open PRs before dispatching more builds; the diagnosis above (`pr-limit.mjs status`) has the exact agent-authored count. '
            + 'If the backlog is expected, lift it deliberately: `node scripts/operations/pr-limit.mjs off --reason=… --for=2h`.',
      });
    }
    return out;
  },
};
