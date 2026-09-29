/**
 * Seed smell 8 / #4066 — PRs stuck per stage, SYSTEMIC: `minCluster` (3) or more open PRs of one repo sitting in
 * the SAME review stage with no activity past that stage's threshold at once. One stuck PR is the stuck-PR watch's
 * job (`we:scripts/conveyor/stuck-pr-watch.mjs`, one diagnose-only inspection per PR episode); three stuck in the
 * same stage together is a stage-level problem (a review daemon not dispatching, a drain not merging) no single
 * per-PR inspection names.
 *
 * ALERT-ONLY, BY RULING (4065 Fork 2: "a systemic cluster of ≥ 3 PRs stuck in one stage (its recommendation
 * aggregates the stuck-PR inspections already posted, so no third agent reads one incident)"). `action: 'alert'`
 * means `planActions` never plans an `investigate` entry and `planInvestigations` never picks it as a candidate,
 * so this smell can never double-dispatch over PRs the stuck-PR watch already inspects. Instead the
 * recommendation READS what the watch already did: its dispatch markers and its inspectors' diagnosis comments,
 * off each PR's own comment thread (`we:scripts/conveyor/stuck-pr-dispatch-marker.mjs`).
 *
 * Stage and exclusions are the stuck-PR watch's OWN (`classifyStuckStage` / `isNeverStuckPr` /
 * `DEFAULT_STUCK_THRESHOLD_MINUTES`), never re-derived. The one deliberate difference is the activity clock: the
 * watch reads each candidate's timeline (one gh call per PR); this smell uses the PR's `updatedAt` from the
 * shared open-PR snapshot (no extra call). `updatedAt` moves on ANY event, so it is never older than the watch's
 * progress clock: a PR this smell calls stuck is stuck by the watch's measure too. The reverse can miss (the
 * watch's own marker comment bumps `updatedAt`), which only under-counts, never raises a false cluster.
 *
 * A PR with a live `review-`/`fix-`/`ci-heal-`/`conflict-` session named after it is not counted: something is
 * working it (the watch's own liveness exclusion, by session name).
 */
import { MINUTE } from '../health-watch-core.mjs';
import { classifyStuckStage, isNeverStuckPr, DEFAULT_STUCK_THRESHOLD_MINUTES } from '../stuck-pr-watch-core.mjs';
import {
  stuckDispatchEpisodes, STUCK_INSPECTION_COMMENT_PREFIX, STUCK_DISPATCH_MARKER, STUCK_DISPATCH_RETRACTED_MARKER,
} from '../stuck-pr-dispatch-marker.mjs';

const TERMINAL_AGENT_STATES = new Set(['done', 'stopped', 'failed']);

/** PURE: a live session named after this PR (the conveyor's `<role>-<pr>` naming), or null. */
export function workingSession(agents, prNumber) {
  const re = new RegExp(`^(review|fix|ci-heal|heal|conflict)-(?:.*\\D)?${prNumber}(?:\\D|$)`);
  return (agents || []).find((a) => a && !TERMINAL_AGENT_STATES.has(a.state) && re.test(a.name || '')) ?? null;
}

/** PURE: what the stuck-PR watch already did on this PR — its live dispatch episodes, and the inspecting agents'
 *  own diagnosis comments (the `🔎 stuck-PR inspection` comments that are neither the marker nor a retraction). */
export function stuckWatchRecord(comments) {
  const list = Array.isArray(comments) ? comments : [];
  const diagnoses = [];
  for (const c of list) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string') continue;
    const lead = body.trimStart();
    if (!lead.startsWith(STUCK_INSPECTION_COMMENT_PREFIX)) continue;
    if (lead.startsWith(STUCK_DISPATCH_MARKER) || lead.startsWith(STUCK_DISPATCH_RETRACTED_MARKER)) continue;
    // First line after the heading that says something — the finding, not the title.
    const line = lead.split('\n').slice(1).map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean) ?? '';
    diagnoses.push({ at: c?.createdAt ?? null, excerpt: line.slice(0, 160) });
  }
  return { dispatchedEpisodes: stuckDispatchEpisodes(list).length, diagnoses };
}

function stuckMinutes(pr, now) {
  const t = Date.parse(pr?.updatedAt ?? '');
  return Number.isFinite(t) && t <= now ? (now - t) / MINUTE : null;
}

export default {
  id: 'pr-stage-stall',
  scope: 'repo',
  cadence: 'gh',
  probes: ['prs', 'agents'],
  // Two gh samples (15 min apart) — a cluster that clears on the next drain pass never opens.
  openAfter: 2,
  closeAfter: 2,
  severity: 'medium',
  action: 'alert',
  minCluster: 3,
  thresholds: DEFAULT_STUCK_THRESHOLD_MINUTES,
  recommendationHint: 'Several PRs are stuck in the same review stage at once — a stage-level stall, not a per-PR one.',
  evaluate({ prs, agents }, { now }) {
    const clusters = new Map();
    for (const pr of prs || []) {
      if (isNeverStuckPr(pr)) continue;
      const stage = classifyStuckStage(pr);
      if (!stage) continue;
      const mins = stuckMinutes(pr, now);
      const threshold = this.thresholds[stage] ?? DEFAULT_STUCK_THRESHOLD_MINUTES[stage];
      if (mins == null || mins < threshold) continue;
      if (workingSession(agents, pr.number)) continue;
      const key = `${pr.repo}:${stage}`;
      if (!clusters.has(key)) clusters.set(key, { repo: pr.repo, stage, threshold, prs: [] });
      clusters.get(key).prs.push({ number: pr.number, minutes: Math.round(mins), ...stuckWatchRecord(pr.comments) });
    }
    const out = [];
    for (const [subject, c] of clusters) {
      c.prs.sort((a, b) => b.minutes - a.minutes);
      const inspected = c.prs.filter((p) => p.dispatchedEpisodes > 0 || p.diagnoses.length > 0);
      const breach = c.prs.length >= this.minCluster;
      const list = c.prs.map((p) => `#${p.number} (${p.minutes}m)`).join(', ');
      const findings = inspected.flatMap((p) => p.diagnoses.slice(-1).map((d) => `#${p.number}: ${d.excerpt || '(no text)'}`));
      out.push({
        subject,
        breach,
        measure: {
          repo: c.repo, stage: c.stage, thresholdMinutes: c.threshold, stuck: c.prs.length, minCluster: this.minCluster,
          inspected: inspected.length, prs: c.prs.map((p) => ({ number: p.number, minutes: p.minutes, dispatchedEpisodes: p.dispatchedEpisodes, diagnoses: p.diagnoses.length })),
        },
        summary: `${c.prs.length} PR(s) in ${c.repo} stuck in \`${c.stage}\` past ${c.threshold}m with no live session: ${list}.`
          + ` The stuck-PR watch has inspected ${inspected.length} of them.`,
        recommendation: !breach ? 'ok'
          : `The \`${c.stage}\` stage itself is stalled in ${c.repo} (${c.prs.length} PRs). No new agent is dispatched for this — `
            + (findings.length
              ? `read the stuck-PR inspections already posted first: ${findings.join(' | ')}.`
              : inspected.length
                ? `the stuck-PR watch dispatched inspections on ${inspected.map((p) => `#${p.number}`).join(', ')}; their findings are not posted yet.`
                : 'the stuck-PR watch has not inspected any of them yet (check it is running: `node scripts/conveyor/stuck-pr-watch.mjs sweep --dry-run`).')
            + ` Then check the daemon that owns the \`${c.stage}\` stage (\`node scripts/operations/run.mjs dispatch-eligibility\`).`,
      });
    }
    return out;
  },
};
