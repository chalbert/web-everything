/**
 * review-escalation.mjs — the DETERMINISTIC drain review-escalation rubric (#2171, under #2162).
 *
 * The drain must decide — with NO judgment in the merge session — whether a ready `lane/*` PR gets a full
 * independent review before it merges. This module is that decision, as pure functions the drain (and its
 * tests) call: a rubric SCORER (which signals fire → escalate?), the ratified LABEL convention the reviewer
 * verdict rides on, the COUPLE rule (impl+WE couples inherit the strictest member), and the non-blocking
 * REVIEW gate (park-alive vs merge). No git/gh here — the caller supplies the signals (diff,
 * dismissed-findings count, cross-repo shape) and the observed PR labels.
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

/**
 * Provisioning metadata for the verdict labels (#2279) — the SINGLE SOURCE OF TRUTH for each label's
 * GitHub color + description, so the drain's on-demand upsert (and any bootstrap provisioner) derive
 * from here and never drift from the names above. Keyed by label name (a REVIEW_LABELS value) and
 * covering EVERY label incl. review:human (#2285), so no label is minted with a placeholder color.
 * Colors are 6-hex, no leading '#'.
 */
export const REVIEW_LABEL_META = {
  [REVIEW_LABELS.pending]:  { color: 'FBCA04', description: 'Drain parked this PR — an independent review is owed before it merges (#2171)' },
  [REVIEW_LABELS.accepted]: { color: '0E8A16', description: 'Reviewer accepted — the drain may merge (#2171)' },
  [REVIEW_LABELS.changes]:  { color: 'D93F0B', description: 'Reviewer wants changes — the author lane fixes hot-context and re-pushes (#2171)' },
  [REVIEW_LABELS.human]:    { color: 'B60205', description: 'Conflict of interest: the diff edits the auto-review trust chain — only a human may clear it (#2285)' },
};

/** Default rubric thresholds (tuning knobs — loose to start). */
export const DEFAULT_THRESHOLDS = {
  diffLines: 400,   // a PR changing ≥ this many lines escalates on size alone
  sampleNth: 10,    // 1-in-N sampling floor: every Nth PR escalates regardless (keeps lane self-review honest)
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
  // The tripwire suite that PROVES the safety invariants of the two files above (gate-self ⇒ human, no
  // auto-merge under review:human, red never mergeable, drain sole-writer, …). It is in this list on purpose:
  // weakening an invariant is the one gate change an agent must not clear, so editing it forces review:human —
  // shrinking human review of gate changes down to "changes to what the invariants assert". See the file header.
  /(^|\/)scripts\/lib\/__tests__\/gate-invariants\.test\.mjs$/,
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
 * #2390-review-fix — the gate-self / `humanRequired` trigger reads `humanBasisFiles` (the CUMULATIVE
 * `origin/main…head` file set), NOT the possibly-de-inflated own-delta `changedFiles`. A stacked lane may
 * de-inflate its SIZE / blast-radius by scoring `base…head` (that is #2390's legitimate intent), but a
 * self-declared / mis-set `base` MUST NOT be able to shrink the basis the human gate reads — else an ancestor's
 * edit to the auto-review trust chain (or a `base==head` mis-set) would drop out of the diff and merge with NO
 * human review (defeats #2285). So the human gate always sees the full cumulative set: an ancestor's OR the
 * child's gate-self edit always forces `review:human`. Over-escalating here is the safe direction. When
 * `humanBasisFiles` is omitted it falls back to `changedFiles` (the non-stacked case, where the two are
 * identical), so every existing caller is unchanged.
 *
 * @param {{changedFiles?:string[], diffLines?:number, humanBasisFiles?:string[]|null, dismissedFindings?:number,
 *          crossRepo?:boolean, prNum?:number, thresholds?:object}} o
 */
export function scoreEscalation({
  changedFiles = [],
  diffLines = 0,
  humanBasisFiles = null,
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

  // #2390-review-fix — gate-self over the cumulative basis (a self-declared/mis-set stacked `base` can never
  // shrink it), falling back to `changedFiles` when no separate basis is supplied.
  const gateBasis = Array.isArray(humanBasisFiles) ? humanBasisFiles : (Array.isArray(changedFiles) ? changedFiles : []);
  const gateSelfFiles = gateBasis.filter(isGateSelfPath);
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
 * #2307 — the deterministic review label the PRODUCER (`pr-land.mjs`) applies at PR-OPEN, from the SAME
 * `scoreEscalation` verdict the drain scores later — so a PR that will need review carries `review:human` /
 * `review:pending` from the start, never only after a drain happens to sweep it (#2281's rule applied to the
 * review dimension). Pure — a producer-time simplification of `decideReviewGate`: at open there is no prior
 * park state / reviewer verdict / timeout to weigh yet (nothing has been parked), so the outcome collapses to
 * the rubric's own escalate/humanRequired verdict. `null` means no review label to apply (a plain `merge`
 * PR — `ready-to-merge` alone is enough).
 * @param {{escalate:boolean, humanRequired?:boolean}} score
 * @returns {string|null}
 */
export function producerReviewLabel({ escalate, humanRequired = false } = {}) {
  if (humanRequired) return REVIEW_LABELS.human;
  if (escalate) return REVIEW_LABELS.pending;
  return null;
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
 * #2366 — the HARD REFUSAL a merge step must apply on ANY path that does NOT run the full escalation rubric
 * this pass (chiefly the bare `/merge` orphan sweep — `REVIEW_ESCALATION` is `--label`-gated in
 * `merge-ai-prs.mjs`, so a bare sweep never calls `decideReviewGate` at all). WITHOUT this, a concurrent lander
 * (a second `/merge` sweep, or a bare one racing the label-scoped `/drain`) reads a PR's OTHER signals
 * (AI-generated, required check green, mergeable) and merges it straight through, even though a prior drain
 * pass already parked it under `review:pending`/`review:human` (an owed independent review, never cleared) or
 * bounced it under `review:changes` (the author lane hasn't fixed it yet) — exactly how plateau#11 and
 * web-everything#290 shipped 2 bugs the review panel had already caught but never got to act on. `review:accepted`
 * always clears it (the reviewer's verdict wins over everything else). Pure.
 *
 * A caller that DOES run `decideReviewGate` this pass (the label-scoped `/drain` role, escalation ON) must NOT
 * also apply this check — `decideReviewGate` already re-derives the correct verdict from a FRESH rubric score,
 * so double-gating on raw label presence here would fight the richer verdict. Note `decideReviewGate` never
 * sees the `--no-review-escalation` flag: under that override the CLI SKIPS `decideReviewGate` entirely
 * (`REVIEW_ESCALATION` is false in `merge-ai-prs.mjs`), and the override is honored HERE — the CLI's
 * `!REVIEW_ESCALATION` branch calls this check with `allowPending: true`, which is the ONLY place the
 * override's `review:human`/`review:changes` refusals are enforced. Do not route the override through
 * `decideReviewGate` (it has no such input) or prune this check as redundant on that path.
 *
 * `allowPending` (#2366 fix-up) — the ONE knob that separates the two `!REVIEW_ESCALATION` callers. The BARE
 * `/merge` orphan sweep (no `--label`) has no owner for the review verdict, so it refuses ALL un-cleared labels
 * (`allowPending: false`, the default — the plateau#11 / web-everything#290 race). But `--label
 * --no-review-escalation` is an OPERATOR deliberately waiving the escalation rubric to push a green-but-parked
 * `review:pending` PR through (backlog #2262's documented manual override for a sampled PR with no reviewer
 * daemon) — that path passes `allowPending: true` so it honors the operator on `review:pending`, yet STILL
 * refuses `review:human` (a gate-self edit is human-only, never waivable by this flag — #2285) and
 * `review:changes` (the reviewer actively rejected the diff; the author lane must re-push). With no review
 * timeout (x30jq9n) this override is the ONE relief valve for a parked `review:pending` PR whose review never
 * arrives — and without this split a blunt `!REVIEW_ESCALATION` gate either strands that PR forever OR (if
 * relaxed wholesale) lets an un-reviewed `review:human`/`review:changes` PR merge under the override — both wrong.
 * @param {Array} labels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @param {{allowPending?: boolean}} [opts] - `allowPending: true` on the explicit `--no-review-escalation`
 *   operator override — refuse only `review:human`/`review:changes`, not `review:pending`.
 * @returns {boolean} true iff this PR carries an un-cleared review-escalation label and must be refused
 */
export function hasUnclearedReviewLabel(labels, { allowPending = false } = {}) {
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) return false;
  return (!allowPending && hasReviewLabel(labels, REVIEW_LABELS.pending))
    || hasReviewLabel(labels, REVIEW_LABELS.human)
    || hasReviewLabel(labels, REVIEW_LABELS.changes);
}

/**
 * #2307 — should a caller (producer OR drain) actually ISSUE the `gh pr edit --add-label` call for a verdict
 * label? Pure. `false` when there is no label to apply, or the PR already carries it — the producer applies the
 * label at open, so a LATER drain pass re-scoring the same PR must treat it as already-scored and never
 * double-apply (GitHub's add-label is idempotent either way, but a skipped call keeps the drain's own action
 * log honest: this pass did nothing new). This is the ONE gate both `pr-land.mjs` (producer, first-applier) and
 * `merge-ai-prs.mjs` (drain, idempotent backstop/reconcile) share, so they can never drift on what "already
 * labelled" means.
 * @param {string|null|undefined} label - the verdict label the current rubric verdict implies (e.g. `gate.applyLabel`)
 * @param {Array} currentLabels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @returns {boolean}
 */
export function shouldApplyReviewLabel(label, currentLabels) {
  return !!label && !hasReviewLabel(currentLabels, label);
}

/**
 * #2324 (guarantee 2) — a `review:human` PR must STATE why a human is required, so the operator opening it
 * sees the escalation reason without re-deriving it from the rubric. The drain writes/augments the PR body
 * with this marked block at park time (`buildEscalationReasonBlock`); the gate then verifies it is there
 * (`bodyHasEscalationReason`) before trusting the park is self-explanatory. Pure — a stable, greppable marker.
 */
export const ESCALATION_REASON_MARKER = '## Escalation reason';

/** Build the body block embedding the escalation reason(s) — APPENDED to the existing PR body at park time,
 *  never replacing it. Pure. Empty/absent `reasons` → `''` (nothing to append). */
export function buildEscalationReasonBlock(reasons) {
  const list = (Array.isArray(reasons) ? reasons : []).filter(Boolean);
  if (!list.length) return '';
  return `\n\n${ESCALATION_REASON_MARKER}\n\n${list.map((r) => `- ${r}`).join('\n')}\n`;
}

/** Does this PR body already carry the escalation-reason marker (#2324)? Pure — the cheap presence check the
 *  gate verifies without re-deriving the reasons itself. */
export function bodyHasEscalationReason(body) {
  return typeof body === 'string' && body.includes(ESCALATION_REASON_MARKER);
}

/**
 * The NON-BLOCKING review gate (#2171). Given a PR's escalation verdict and its observed review labels, decide
 * what the drain does THIS pass. Pure — the drain never blocks: an escalated PR is SKIPPED (parked alive) and
 * re-evaluated next pass, so other PRs keep flowing.
 *   'merge'        — not escalated, OR reviewer accepted → land it now.
 *   'wait-author'  — reviewer asked for changes → the author lane fixes hot-context + re-pushes; skip for now.
 *   'park'         — escalated, no verdict yet → apply a park label, skip (parked alive). For an agent-reviewable
 *                    PR that label is review:pending; for a HUMAN-gated PR (#2285 v1) it is review:human (only a
 *                    human may clear it). The human gate is STICKY on the LABEL (#2362): a PR ALREADY carrying
 *                    review:human parks even if this pass's fresh score de-escalated it (e.g. the gate-self file
 *                    dropped out on rebase).
 * A park NEVER times out (x30jq9n, resolving #2412 Gap 1 — the old 30-min merge-anyway window raced the very
 * review it was waiting for; observed: #396 merged mid-negotiation, stranding mandatory-lens fixes). A parked
 * PR rests parked until a verdict label arrives; a genuinely stuck park is the operator's call — a manual
 * `/drain` with `--no-review-escalation` (see `hasUnclearedReviewLabel`'s `allowPending`) — never an auto-land.
 * @param {{escalate:boolean, humanRequired?:boolean, labels?:Array}} o
 */
export function decideReviewGate({ escalate, humanRequired = false, labels = [] } = {}) {
  // A reviewer verdict (whoever applied it — for a human-gated PR only a human can) always wins, and is checked
  // FIRST so it overrides even the sticky human gate below: review:accepted IS the human clearing the gate →
  // merge; review:changes → the author lane fixes + re-pushes.
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) return { action: 'merge', reason: 'review:accepted — reviewer accepted, merge' };
  // wait-author STILL carries humanRequired: a gate-self PR (fresh score OR a sticky review:human label) that
  // also carries review:changes must NOT be reported to the caller as humanRequired:false — the caller keys the
  // drain's auto-review routing on this field (#2365), and false there lets an agent panel clear a gate-self edit
  // that a human bounced. Since this branch precedes the human gate below, propagate the human signal here too.
  if (hasReviewLabel(labels, REVIEW_LABELS.changes)) return { action: 'wait-author', reason: 'review:changes — author lane fixes + re-pushes', humanRequired: humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human) };
  // #2285 v1 + #2362 — the human gate is STICKY on the LABEL, not only this pass's fresh score. Park under
  // review:human and NEVER time out. Honour humanRequired (fresh gate-self score) OR an already-applied
  // review:human label: the fresh score can flip to false if the diff NARROWED after the label was stamped
  // (e.g. a gate-self file dropped out on rebase — exactly how #289 rode the since-removed merge-anyway window
  // to land while still carrying review:human). The sticky label vetoes regardless, so once any pass gates a PR
  // to a human, only a human clearing it (→ review:accepted, handled above) may merge. Checked BEFORE the
  // !escalate-merge branch so a human-gated PR can never merge without a human — even if it later de-escalates.
  if (humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human)) {
    return { action: 'park', reason: 'human-gated (review:human) — only a human may clear it', applyLabel: REVIEW_LABELS.human, humanRequired: true };
  }
  if (!escalate) return { action: 'merge', reason: 'no escalation signal — merge immediately' };
  // Agent-reviewable escalation, no verdict yet → park alive and wait for the verdict label. No timeout
  // (x30jq9n): landing unreviewed code on a clock is never the right failure mode; a stuck park is handled by
  // the operator, not by the drain.
  return { action: 'park', reason: 'escalated — awaiting an independent review (review:pending)', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
}
