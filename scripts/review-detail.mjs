/**
 * review-detail.mjs — assemble a PARKED PR's review context as one JSON object (#2470, increment 1 of 2).
 *
 * READ-ONLY. A single `gh pr view` gathers a PR's body/labels/comments/files; the PURE `assembleReviewDetail`
 * distills them into the stable contract the Plateau Loop review console (the plateau dev-panel) shells and
 * renders — the escalation reason the drain stamped, the drain's advisory AI-review comment, any prior human
 * verdict comment, the derived review disposition, the diff stat, and the review-class labels. Single-sourced
 * in WE (Native-First / zero standard-impl here — this is a definition + read tool, not product code) so the
 * console never re-implements how a park is read.
 *
 * Split mirrors the daemon's lib/shell split (and `we:scripts/lane-review.mjs`): a PURE assembler that takes an
 * already-parsed `gh pr view … --json` object and returns the contract, plus a thin impure CLI that does the one
 * `gh` call and prints. The assembler REUSES `we:scripts/lib/review-escalation.mjs`
 * (`ESCALATION_REASON_MARKER`, `REVIEW_LABELS`, `hasReviewLabel`) and `we:scripts/lib/review-core.mjs`
 * (`deriveReviewDisposition`) — it never re-hardcodes those markers/labels/logic.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ESCALATION_REASON_MARKER, REVIEW_LABELS, hasReviewLabel } from './lib/review-escalation.mjs';
import { deriveReviewDisposition } from './lib/review-core.mjs';

/** The drain's advisory AI-review comment marker (the body the drain posts on an agent-review park). */
const ADVISORY_MARKER = '🤖 advisory AI review';
/** A prior human-verdict comment starts with one of these (accept ✅ / bounce-back 🔁). */
const HUMAN_MARKERS = ['✅ human review', '🔁 human review'];

/**
 * Parse the body's `## Escalation reason` block (#2324) — the lines AFTER the `ESCALATION_REASON_MARKER` line
 * up to the next `##` heading or end-of-body. Each reason is a `- <reason>` bullet (from
 * `we:scripts/lib/review-escalation.mjs`'s `buildEscalationReasonBlock`); the leading bullet marker is stripped
 * so the returned strings are the bare decorated reasons `deriveReviewDisposition` canonicalizes. Pure. Returns
 * `[]` when the body is absent or carries no such block (an unparked PR). Tolerant of a missing body.
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
export function parseEscalationReason(body) {
  if (typeof body !== 'string') return [];
  const lines = body.split('\n');
  const markerIdx = lines.findIndex((l) => l.trim() === ESCALATION_REASON_MARKER);
  if (markerIdx === -1) return [];
  const out = [];
  for (let i = markerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('##')) break; // next heading ends the block
    const trimmed = line.trim();
    if (!trimmed) continue; // skip blank lines (incl. the marker's trailing blank)
    out.push(trimmed.replace(/^[-*]\s+/, '')); // strip the `- `/`* ` bullet → bare reason
  }
  return out;
}

/** Map a raw `gh` labels array (objects `{name}` or strings) to a plain name array. Pure, tolerant of absent. */
function labelNames(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === 'string' ? l : l && l.name))
    .filter(Boolean);
}

/**
 * The PURE review-context assembler (#2470). Takes the parsed `gh pr view … --json` object and returns the
 * STABLE contract the Plateau Loop review console depends on. Never throws on a missing field — an unparked PR
 * yields `escalationReason: []`, `disposition: null`, `reviewClass: "none"`.
 * @param {{view: object}} o - `view` is the parsed `gh pr view` JSON (number,title,url,body,labels,comments,files).
 * @returns {{pr:number, repo:string, title:string, url:string, labels:string[], humanRequired:boolean,
 *   reviewClass:('human'|'pending'|'none'), disposition:(object|null), escalationReason:string[],
 *   advisoryComment:(string|null), humanComment:(string|null),
 *   diffStat:Array<{path:string, additions:number, deletions:number}>, filesChanged:number}}
 */
export function assembleReviewDetail({ view } = {}) {
  const v = view || {};
  const labels = labelNames(v.labels);
  const humanRequired = hasReviewLabel(labels, REVIEW_LABELS.human);
  const reviewClass = humanRequired
    ? 'human'
    : hasReviewLabel(labels, REVIEW_LABELS.pending)
      ? 'pending'
      : 'none';

  const escalationReason = parseEscalationReason(v.body);
  // Disposition is derivable ONLY from a non-empty escalation block; deriveReviewDisposition throws on an
  // empty/unknown reason set, so guard both — an unparked PR (or one whose reasons don't canonicalize) → null.
  let disposition = null;
  if (escalationReason.length) {
    try { disposition = deriveReviewDisposition({ reasons: escalationReason }); }
    catch { disposition = null; }
  }

  const comments = Array.isArray(v.comments) ? v.comments : [];
  const bodyOf = (c) => (c && typeof c.body === 'string' ? c.body : '');
  const lastMatching = (pred) => {
    for (let i = comments.length - 1; i >= 0; i--) {
      const b = bodyOf(comments[i]);
      if (pred(b)) return b;
    }
    return null;
  };
  const advisoryComment = lastMatching((b) => b.includes(ADVISORY_MARKER));
  const humanComment = lastMatching((b) => HUMAN_MARKERS.some((m) => b.trimStart().startsWith(m)));

  const diffStat = (Array.isArray(v.files) ? v.files : []).map((f) => ({
    path: String(f && f.path != null ? f.path : ''),
    additions: Number(f && f.additions) || 0,
    deletions: Number(f && f.deletions) || 0,
  }));

  return {
    pr: Number(v.number) || 0,
    repo: String(v.repo || ''),
    title: String(v.title || ''),
    url: String(v.url || ''),
    labels,
    humanRequired,
    reviewClass,
    disposition,
    escalationReason,
    advisoryComment,
    humanComment,
    diffStat,
    filesChanged: diffStat.length,
  };
}

// Allow importing the pure assembler without running the CLI (the test file imports this module) — the standard
// main check used in `we:scripts/lane-review.mjs`.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const repo = (args.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const pr = args.find((a) => /^\d+$/.test(a));

  if (!pr || !repo) {
    process.stdout.write(`${JSON.stringify({ error: 'usage: review-detail.mjs <pr> --repo=<owner/name> [--json]' })}\n`);
    process.exit(2);
  }

  let view;
  try {
    const out = execFileSync('gh', [
      'pr', 'view', pr, '--repo', repo, '--json', 'number,title,url,body,labels,comments,files',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    view = JSON.parse(out);
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'gh pr view failed';
    process.stdout.write(`${JSON.stringify({ error: msg })}\n`);
    process.exit(1);
  }

  // `gh pr view` does not echo the repo back in its JSON — carry the requested one so the contract is complete.
  view.repo = repo;
  const detail = assembleReviewDetail({ view });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(detail, null, 2)}\n`);
    process.exit(0);
  }

  const lines = [
    `${detail.repo}#${detail.pr} — ${detail.title}`,
    `  ${detail.url}`,
    `  review: ${detail.reviewClass}${detail.humanRequired ? ' (human required)' : ''}  labels: ${detail.labels.join(', ') || '(none)'}`,
    `  disposition: ${detail.disposition ? `${detail.disposition.mode} (autoLand=${detail.disposition.autoLand})` : '(none)'}`,
    `  escalation reason: ${detail.escalationReason.length ? `\n    - ${detail.escalationReason.join('\n    - ')}` : '(none)'}`,
    `  files changed: ${detail.filesChanged}`,
    `  advisory comment: ${detail.advisoryComment ? 'yes' : 'no'}   human comment: ${detail.humanComment ? 'yes' : 'no'}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(0);
}
