/**
 * review-escalation.mjs — the DETERMINISTIC drain review-escalation rubric (#2171, under #2162).
 *
 * The drain must decide — with NO judgment in the merge session — whether a ready `lane/*` PR gets a full
 * independent review before it merges. This module is that decision, as pure functions the drain (and its
 * tests) call: a rubric SCORER (which signals fire → escalate?), the ratified LABEL convention the reviewer
 * verdict rides on, the COUPLE rule (impl+WE couples inherit the strictest member), and the non-blocking
 * WATCH-WINDOW gate (park-alive vs merge vs merge-anyway-on-timeout). No git/gh here — the caller supplies the
 * signals (diff, dismissed-findings count, cross-repo shape) and the observed PR labels + park age.
 *
 * WHY deterministic: a rubric a script evaluates keeps the merge session free of judgment (which lane needs a
 * second look is decided by rule, not by the merging agent eyeballing the diff). Thresholds are TUNING KNOBS
 * — start loose, tighten from data; they live here so a change is one edit + a test, never scattered.
 */

/** The ratified reviewer-verdict labels (#2171). The reviewer's disposition is a LABEL, never comment-parsing:
 *  independent *disposition* (reviewer accepts/rejects) is split from hot-context *fixing* (the author lane). */
export const REVIEW_LABELS = {
  pending: 'review:pending',   // the drain parked this PR — an independent review is owed before merge
  accepted: 'review:accepted', // reviewer accepted → the drain may merge
  changes: 'review:changes',   // reviewer wants changes → the author lane fixes hot-context + re-pushes
  human: 'review:human',       // #2285 v1 — conflict of interest: the diff edits the auto-review trust chain; only a HUMAN may clear it (an agent must not auto-accept)
};

/** Default rubric thresholds (tuning knobs — loose to start). */
export const DEFAULT_THRESHOLDS = {
  diffLines: 400,   // a PR changing ≥ this many lines escalates on size alone
  sampleNth: 10,    // 1-in-N sampling floor: every Nth PR escalates regardless (keeps lane self-review honest)
  windowMinutes: 30, // the watch window before a stalled review times out to merge-anyway
};

/** High-blast-radius path patterns (#2171). A diff touching any of these is escalation-worthy on its own —
 *  these files change how the system itself behaves, so a bad merge there is far costlier than a leaf edit. */
const BLAST_RADIUS = [
  /^scripts\//,                              // build/CI/merge tooling (this very lander included)
  /(^|\/)\.claude\/skills\//,                // agent skills (the operating procedures)
  /(^|\/)\.githooks\//,                       // git hooks (the guards)
  /(^|\/)\.github\//,                         // CI config / workflows
  /^docs\/agent\/platform-decisions\.md$/,   // the statute layer (cite-able cluster rules)
  /^docs\/agent\/.*statute/i,                // any statute doc
  /^src\/_data\/(blocks|plugs|intents|protocols|semantics)\.json$/, // standards definitions
];

/** Does this repo-relative path hit a high-blast-radius surface? Pure. */
export function isBlastRadiusPath(path) {
  const p = String(path || '');
  return BLAST_RADIUS.some((re) => re.test(p));
}

/** The AUTO-REVIEW TRUST CHAIN (#2285 v1). A diff touching one of these files edits the very machinery that
 *  decides whether the review gate fires and what clears it — so an *agent* reviewing such a change would be
 *  policing an edit to its own leash (a genuine conflict of interest). These, and ONLY these, force a HUMAN
 *  review (`review:human`). Every other blast-radius path is agent-reviewable: a fresh-context adversarial
 *  reviewer is independent of the *producer* there, with no self-gate conflict. Keep this list MINIMAL — human
 *  gate = judgment essential, not merely "important" (a wider net just re-strands the queue on humans). */
const GATE_SELF_PATHS = [
  /(^|\/)scripts\/lib\/review-escalation\.mjs$/, // the escalation rubric itself (this file)
  /(^|\/)scripts\/merge-ai-prs\.mjs$/,           // the lander that reads the verdict labels + decides to merge
];

/** Does this repo-relative path edit the auto-review trust chain (→ a human review is essential)? Pure. */
export function isGateSelfPath(path) {
  const p = String(path || '');
  return GATE_SELF_PATHS.some((re) => re.test(p));
}

/**
 * Score ONE ready PR against the escalation rubric. Pure. Returns `{ escalate, reasons, signals }` — `escalate`
 * is true iff ANY rubric signal fired; `reasons` is the human-readable rule outcome the drain STAMPS
 * (`escalated: yes/no` + why). Signals (each independent):
 *   • blast-radius — the diff touches a high-blast-radius surface (scripts/, skills, hooks, CI, statute, defs).
 *   • size         — total changed lines ≥ thresholds.diffLines.
 *   • dismissed    — the lane's pre-PR review (#2170) DISMISSED ≥1 finding — the STRONGEST signal (it targets
 *                    author anchoring directly: the lane judged its own reviewer's findings away).
 *   • cross-repo   — an impl+WE couple spanning >1 repo (a coordinated multi-repo change).
 *   • sampling     — the 1-in-N floor (prNum % sampleNth === 0): keeps "no dismissals" from being a gameable exit.
 *
 * Also returns `humanRequired` (#2285 v1): true iff the diff touches the auto-review trust chain
 * (`isGateSelfPath`) — the one class where an agent reviewer has a conflict of interest, so a human review is
 * essential. It's a *classification* of an already-escalating PR (a gate-self file is always blast-radius too),
 * never a fresh escalation trigger.
 *
 * @param {{changedFiles?:string[], diffLines?:number, dismissedFindings?:number, crossRepo?:boolean,
 *          prNum?:number, thresholds?:object}} o
 */
export function scoreEscalation({
  changedFiles = [],
  diffLines = 0,
  dismissedFindings = 0,
  crossRepo = false,
  prNum = 0,
  thresholds = {},
} = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const reasons = [];
  const signals = {};

  const blastFiles = (Array.isArray(changedFiles) ? changedFiles : []).filter(isBlastRadiusPath);
  if (blastFiles.length) { signals.blastRadius = blastFiles; reasons.push(`blast-radius (${blastFiles.slice(0, 3).join(', ')}${blastFiles.length > 3 ? ', …' : ''})`); }

  const gateSelfFiles = (Array.isArray(changedFiles) ? changedFiles : []).filter(isGateSelfPath);
  const humanRequired = gateSelfFiles.length > 0;
  if (humanRequired) { signals.gateSelf = gateSelfFiles; reasons.push(`gate-self (${gateSelfFiles.join(', ')}) — human review required`); }

  if (Number(diffLines) >= t.diffLines) { signals.size = Number(diffLines); reasons.push(`size (${diffLines} ≥ ${t.diffLines} changed lines)`); }

  if (Number(dismissedFindings) > 0) { signals.dismissedFindings = Number(dismissedFindings); reasons.push(`dismissed-findings (${dismissedFindings} pre-PR review finding(s) the lane dismissed)`); }

  if (crossRepo) { signals.crossRepo = true; reasons.push('cross-repo impl+WE couple'); }

  // Deterministic 1-in-N sampling floor: keyed on the PR number so it's reproducible (never Math.random).
  if (Number(prNum) > 0 && t.sampleNth > 0 && Number(prNum) % t.sampleNth === 0) { signals.sampled = t.sampleNth; reasons.push(`sampling floor (1-in-${t.sampleNth})`); }

  return { escalate: reasons.length > 0, humanRequired, reasons, signals };
}

/**
 * Couples inherit the STRICTEST member (#2171 / #2138 Fork 5): if EITHER PR of an impl+WE couple escalates,
 * BOTH wait — impl-first/WE-last order cannot tolerate half a couple merging. `humanRequired` inherits the same
 * way (#2285 v1): if either half edits the gate's own code, the whole couple needs a human. Pure.
 * @param {Array<{escalate:boolean, humanRequired?:boolean, reasons?:string[]}>} memberScores
 */
export function coupleEscalation(memberScores) {
  const members = Array.isArray(memberScores) ? memberScores : [];
  const escalate = members.some((m) => m && m.escalate);
  const humanRequired = members.some((m) => m && m.humanRequired);
  const reasons = escalate ? [...new Set(members.flatMap((m) => (m && m.reasons) || []))] : [];
  return { escalate, humanRequired, reasons };
}

/** Does this PR (or couple) carry a given review label? `labels` is the observed label-name array. Pure. */
export function hasReviewLabel(labels, label) {
  return Array.isArray(labels) && labels.some((l) => (typeof l === 'string' ? l : l && l.name) === label);
}

/**
 * The NON-BLOCKING watch-window gate (#2171). Given a PR's escalation verdict, its observed review labels, and
 * how long it has been parked, decide what the drain does THIS pass. Pure — the drain never blocks: an escalated
 * PR is SKIPPED (parked alive) and re-evaluated next pass, so other PRs keep flowing.
 *   'merge'        — not escalated, OR reviewer accepted → land it now.
 *   'wait-author'  — reviewer asked for changes → the author lane fixes hot-context + re-pushes; skip for now.
 *   'park'         — escalated, no verdict yet → apply a park label, skip (parked alive). For an agent-reviewable
 *                    PR that label is review:pending and the window can time out; for a HUMAN-required PR
 *                    (#2285 v1) it is review:human and there is NO timeout (only a human may clear it).
 *   'merge-anyway' — agent-reviewable, no verdict, window EXPIRED → merge + auto-file the unfinished review
 *                    (never hang on a stalled agent-review). NEVER reached for a human-required PR.
 * @param {{escalate:boolean, humanRequired?:boolean, labels?:Array, parkedSinceMs?:number|null, nowMs?:number, windowMs?:number}} o
 */
export function decideReviewGate({ escalate, humanRequired = false, labels = [], parkedSinceMs = null, nowMs = 0, windowMs = DEFAULT_THRESHOLDS.windowMinutes * 60_000 } = {}) {
  if (!escalate) return { action: 'merge', reason: 'no escalation signal — merge immediately' };
  // A reviewer verdict (whoever applied it — for a human-required PR only a human can) always wins. review:accepted
  // → merge; review:changes → the author lane fixes + re-pushes.
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) return { action: 'merge', reason: 'review:accepted — reviewer accepted, merge' };
  if (hasReviewLabel(labels, REVIEW_LABELS.changes)) return { action: 'wait-author', reason: 'review:changes — author lane fixes + re-pushes' };
  // #2285 v1 — conflict of interest: the diff edits the auto-review trust chain. Park under review:human and
  // NEVER time out — an agent (and the merge-anyway clock) must not clear a change to its own gate. Checked
  // BEFORE the timeout branch so a human-required PR can never ride the window to merge-anyway.
  if (humanRequired) return { action: 'park', reason: 'gate-self edit — a HUMAN review is required (review:human), no timeout', applyLabel: REVIEW_LABELS.human, humanRequired: true };
  // Agent-reviewable escalation, no verdict yet. Time out to merge-anyway once the window elapses so a stalled
  // agent-review never wedges the queue; otherwise park alive and wait.
  if (parkedSinceMs != null && Number(nowMs) - Number(parkedSinceMs) >= Number(windowMs)) {
    return { action: 'merge-anyway', reason: `review window (${Math.round(Number(windowMs) / 60000)}m) expired — merge + auto-file the unfinished review`, autoFile: true };
  }
  return { action: 'park', reason: 'escalated — awaiting an independent review (review:pending)', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
}
