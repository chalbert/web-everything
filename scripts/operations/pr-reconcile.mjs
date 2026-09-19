/**
 * Read-only reconciliation: the same read → assess declaration as pr-status.
 * IO lives in pr-status-io.mjs. Hold conventions and report boundaries are documented in
 * docs/agent/delivery-loop.md → Explain PR holds before dispatching.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { shapeReadFinding, reduceCheckState } from './pr-status.mjs';

export const PR_RECONCILE_OP = 'pr-reconcile';

const ORDER = ['human', 'stand-down', 'conflict', 'dependency', 'advisory-pending'];
const UNBLOCK = {
  human: 'A human must review and explicitly clear the hold through the review ceremony.',
  'stand-down': 'A human must resolve the recorded escalation and remove its stand-down marker or take over with /finish.',
  conflict: 'Resolve the recorded conflict, then rerun checks and review on the resulting head.',
  dependency: 'Land or resolve the named blocking dependency, then reassess this PR.',
  'advisory-pending': 'Complete the pending review; repair any requested changes and re-arm review before clearance.',
};
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const commentOrder = (a, b) => compare(a.createdAt, b.createdAt) || compare(a.url, b.url) || compare(a.body, b.body);
const commentEvidence = (c) => ({ source: 'comment', excerpt: c.body, url: c.url });

/** Refuse incomplete reads; preserve real comment dates only, never the time of this observation. */
export function shapeReconcileFinding(raw) {
  const base = shapeReadFinding(raw);
  const prs = base.prs.map((p, i) => {
    const detail = raw.prs[i];
    if (!['open', 'merged', 'closed'].includes(detail.state) || !Array.isArray(detail.comments)
        || !Array.isArray(detail.standDownEvidence)) {
      throw new Error(`pr-reconcile.read: PR #${p.number} needs state, comments and standDownEvidence`);
    }
    return {
      number: p.number, title: p.title, state: detail.state, headSha: p.headSha,
      mergeable: p.mergeable,
      labels: [...new Set(p.labels)].sort(compare),
      checks: [...p.checks].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))),
      comments: [...detail.comments].sort(commentOrder),
      standDownEvidence: [...detail.standDownEvidence].sort(commentOrder),
    };
  }).sort((a, b) => a.number - b.number);
  return { repo: base.repo, prs, truncated: base.truncated };
}

/** Match explicit statements, not incidental mentions or quoted historical text. */
function commentHold(body) {
  // buildDrainReasonComment wraps the reason in a marker and heading. Strip only that
  // known envelope; quoting one inside a reply must not manufacture a current hold.
  const text = body.trim().replace(/^<!-- drain-(?:park|skip)-reason -->\n[^\n]*\n\n/, '');
  if (/^(?:hold (?:cleared|resolved)|review:accepted)\b/i.test(text)) return 'clear';
  const drain = /^held — a review hold \(([^)]+)\) stands\b/.exec(text);
  if (drain) {
    if (drain[1].split(/,\s*/).includes('review:human')) return 'human';
    if (/review:(?:pending|changes)\b/.test(drain[1])) return 'advisory-pending';
  }
  if (/^(?:human review required|human approval required|awaiting human (?:review|approval))\b/i.test(text)) return 'human';
  if (/^(?:advisory review pending|awaiting advisory review)\b/i.test(text)) return 'advisory-pending';
  if (/^(?:blocked by|waiting on|depends on)\s+(?:PR\s*)?#\d+\b/i.test(text)) return 'dependency';
  if (/^(?:merge conflict|conflicting with|blocked by (?:a |merge )?conflict)\b/i.test(text)
      || /^not mergeable \(mergeable=CONFLICTING\)/.test(text)
      || /^merge state DIRTY\b/.test(text)) return 'conflict';
  return null;
}

/** Multiple holds survive in `holds`; heldBy is just the first actionable reason, never permission. */
export function derivePrHolds(pr) {
  if (pr.state !== 'open') return { heldBy: 'none', heldByEvidence: [], holds: [], unblock: 'No active hold: this PR is already merged or closed.' };
  const holds = [];
  const add = (heldBy, evidence) => holds.push({ heldBy, evidence, unblock: UNBLOCK[heldBy] });
  for (const [label, heldBy] of [
    ['review:human', 'human'], ['review:pending', 'advisory-pending'],
    ['review:changes', 'advisory-pending'], ['blocked', 'dependency'],
  ]) {
    if (pr.labels.includes(label)) add(heldBy, { source: 'label', label });
  }
  for (const c of pr.standDownEvidence) add('stand-down', commentEvidence(c));
  // Latest explicit statement per category wins. A clearance resets ordinary comment holds;
  // stand-down has its own durable semantics and is deliberately not reset by acceptance.
  const active = new Map();
  for (const c of pr.comments) {
    const heldBy = commentHold(c.body);
    if (heldBy === 'clear') active.clear();
    else if (heldBy) active.set(heldBy, c);
  }
  for (const [heldBy, c] of active) {
    add(heldBy, commentEvidence(c));
  }
  holds.sort((a, b) => ORDER.indexOf(a.heldBy) - ORDER.indexOf(b.heldBy)
    || compare(JSON.stringify(a.evidence), JSON.stringify(b.evidence)));
  const heldBy = holds[0]?.heldBy ?? 'none';
  return {
    heldBy,
    heldByEvidence: holds.filter((h) => h.heldBy === heldBy).map((h) => h.evidence),
    holds,
    unblock: UNBLOCK[heldBy] ?? 'No recognized hold; check required-check status and mergeability before proceeding.',
  };
}

export function assessReconcilePrs(finding, requiredCheck = 'test') {
  return {
    repo: finding.repo,
    truncated: finding.truncated,
    prs: finding.prs.map((pr) => ({
      number: pr.number, title: pr.title, state: pr.state, headSha: pr.headSha,
      mergeable: pr.mergeable,
      requiredCheck: { name: requiredCheck, ...reduceCheckState(pr.checks.filter((c) => c.name === requiredCheck)) },
      labels: pr.labels,
      reviewLabels: pr.labels.filter((l) => l.startsWith('review:')),
      comments: pr.comments,
      ...derivePrHolds(pr),
    })),
  };
}

export function prReconcileOperation({ readPrs } = {}) {
  if (typeof readPrs !== 'function') throw new TypeError('pr-reconcile: needs a `readPrs()` reader');
  return op(PR_RECONCILE_OP, {
    input: {
      repo: { type: 'string', required: true },
      pr: { type: 'number', required: false, default: 0 },
      requiredCheck: { type: 'string', required: false, default: 'test' },
    },
    verdictFrom: 'assess',
    read: compute({
      reads: ['input.repo', 'input.pr'],
      fn: (view) => shapeReconcileFinding(readPrs({ repo: view.input.repo, pr: view.input.pr })),
    }),
    assess: compute({
      reads: ['findings.read', 'input.requiredCheck'],
      fn: (view) => assessReconcilePrs(view.findings.read, view.input.requiredCheck),
    }),
  });
}
