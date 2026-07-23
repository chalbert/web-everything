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
import { isTrustChainPath, isPolicyCorePath, basenameOf } from './gate-config.mjs';
import { POLICY_THRESHOLDS } from './review-policy.mjs';

/** The ratified reviewer-verdict labels (#2171). The reviewer's disposition is a LABEL, never comment-parsing:
 *  independent *disposition* (reviewer accepts/rejects) is split from hot-context *fixing* (the author lane). */
export const REVIEW_LABELS = {
  pending: 'review:pending',   // the drain parked this PR — an independent review is owed before merge
  accepted: 'review:accepted', // reviewer accepted → the drain may merge
  changes: 'review:changes',   // reviewer wants changes → the author lane fixes hot-context + re-pushes
  human: 'review:human',       // #2285 v1 — the diff edits the gate's POLICY tier (an agent policing its own leash) or the STATUTE layer; only a HUMAN may clear it. The engine tier (the lander) is agent-reviewable (#2445 two-tier flip)
  redteamAccepted: 'redteam:accepted', // #2439 — the INDEPENDENT hardened validator (a fresh-context adversary that took no part in the negotiation and never saw the peers' self-assessment) signed off on the FINAL diff. The "non-author accepts" invariant, applied by the drain; enforcement (requiring it before an engine-tier auto-land) is #2412's concern
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
  [REVIEW_LABELS.human]:    { color: 'B60205', description: 'The diff edits the gate policy or the statute layer — only a human may clear it (#2285, #2445 two-tier flip)' },
  [REVIEW_LABELS.redteamAccepted]: { color: '5319E7', description: 'An independent hardened validator signed off on the final diff — the non-author-accepts invariant (#2439)' },
};

/** Default rubric thresholds (tuning knobs — loose to start). The VALUES live in the machine-diffable contract
 *  (`./review-policy.contract.json`, #2566) and are imported here so a threshold flip is necessarily a diff to
 *  the contract → a human-gated spec change (not an edit buried in this file). The names/shape stay for every
 *  existing caller; only the source of the numbers moved. */
export const DEFAULT_THRESHOLDS = POLICY_THRESHOLDS;

/** The STATUTE layer (#2412) — `platform-decisions.md` and any statute doc. Editing the cite-able cluster
 *  rules is a governance change a human must ratify, so (like the policy-tier trust chain) it forces
 *  `review:human`, not just an agent panel. Kept as its own set so it drives BOTH escalation (blast-radius,
 *  below) AND the human gate (scoreEscalation). */
const STATUTE_PATHS = [
  /^docs\/agent\/platform-decisions\.md$/,   // the statute layer (cite-able cluster rules)
  /^docs\/agent\/.*statute/i,                // any statute doc
];

/** Does this repo-relative path edit the statute layer (→ a human must ratify)? Pure. (#2412) */
export function isStatutePath(path) {
  const p = String(path || '');
  return STATUTE_PATHS.some((re) => re.test(p));
}

/** High-blast-radius path patterns (#2171). A diff touching any of these is escalation-worthy on its own —
 *  these files change how the system itself behaves, so a bad merge there is far costlier than a leaf edit.
 *
 *  TWO KINDS OF PATTERN, by whether the surface TRAVELS on extraction (#2479, sibling to #2448/#2480):
 *   • CROSS-REPO surfaces (skills, hooks, CI, statute) already anchor with `(^|\/)`, so they match a relocated
 *     copy for free — `plateau-app/.claude/skills/drain/SKILL.md` still trips, just like `.claude/skills/…` does
 *     today. No travel work is needed for these.
 *   • WE-PERMANENT surfaces stay `^`-anchored on purpose: the standards defs (`src/_data/…json`) live in WE
 *     forever (WE holds the standard), and `^scripts\/` escalates every WE script WHILE it is in WE. The
 *     RELOCATABLE delivery-engine scripts (pr-land, lane-drain, …) also match `^scripts\/` while here, but that
 *     match is lost the moment #2445 extracts them out of we:scripts/ — so those, and only those, ALSO travel by
 *     basename via `BLAST_RADIUS_ENGINE` below. WE-only scripts (standards/backlog/memory/conformance/generators)
 *     are deliberately NOT registered there: WE is their permanent home, `^scripts\/` is the correct matcher for
 *     them, and there is nowhere for them to travel to. */
const BLAST_RADIUS = [
  /^scripts\//,                              // build/CI/merge tooling (WHILE in WE; relocatable engine files also travel by basename — see BLAST_RADIUS_ENGINE)
  /(^|\/)\.claude\/skills\//,                // agent skills (the operating procedures) — already travels cross-repo via (^|\/)
  /(^|\/)\.githooks\//,                       // git hooks (the guards) — already travels cross-repo
  /(^|\/)\.github\//,                         // CI config / workflows — already travels cross-repo
  ...STATUTE_PATHS,                          // the statute layer (also forces a human — see scoreEscalation)
  /^src\/_data\/(blocks|plugs|intents|protocols|semantics)\.json$/, // standards definitions — WE-permanent, never relocates
];

/**
 * The RELOCATABLE delivery-ENGINE blast-radius members (#2479, sibling to #2448/#2480). These are the
 * lane→PR→drain→merge transport scripts: escalation-worthy (a bad merge there breaks how the system DELIVERS
 * changes) but NOT the gate-self trust chain (they neither define the gate nor land the merge — that set already
 * travels via `isTrustChainPath`). Mirroring the #2448/#2480 mechanism in gate-config.mjs, each is matched by its
 * BASENAME, so blast-radius TRAVELS with the code when the #2445 coordinator extracts these out of we:scripts/
 * into plateau-app or a package. WITHOUT this, a relocated `pr-land.mjs` / `lane-drain.mjs` would stop matching
 * `^scripts\/` above and an escalation-worthy change would no longer force even an AGENT review.
 *
 * Basename match is strictly MORE inclusive than the anchored `^scripts\/` regex, so it can only ever
 * over-escalate (force a review that wasn't strictly needed) — the safe direction, by policy. Like the trust
 * chain it cannot follow a RENAME: relocate-and-rename a member and you must re-register `file` here.
 *
 * `role`/`desc` document; `homes` records the current known location(s) for auditability only (the matcher does
 * NOT read `homes`). RATIFICATION NOTE (the #2480 generic-basename lesson): every basename below was checked for
 * collisions across the constellation and is UNIQUE — none is generic like `cli.mjs`/`lib.mjs`, so registering it
 * over-escalates NO unrelated file. Keep it that way: only register specific, non-generic engine basenames.
 */
export const BLAST_RADIUS_ENGINE = [
  // ── the lane→PR→land producer side ──────────────────────────────────────────────────────────────────────
  { file: 'pr-land.mjs',            role: 'producer',      desc: 'opens the self-approved PR — the producer half of the lane→PR→drain transport', homes: ['scripts/pr-land.mjs'] },
  { file: 'lane-pool.mjs',          role: 'lane-pool',     desc: 'allocates/recycles the lane clones the transport runs in', homes: ['scripts/lane-pool.mjs'] },
  { file: 'lane-manifest-write.mjs',role: 'lane-manifest', desc: 'writes the lane manifest the drain reads to couple + order PRs', homes: ['scripts/lane-manifest-write.mjs'] },
  { file: 'lane-resume.mjs',        role: 'lane-resume',   desc: 'resumes a partially-run lane (re-enters the transport mid-flight)', homes: ['scripts/lane-resume.mjs'] },
  { file: 'lane-stack.mjs',         role: 'lane-stack',    desc: 'stacks dependent lanes (the base…head chain the escalation basis reads)', homes: ['scripts/lane-stack.mjs'] },
  // ── the drain / merge side (the #2445 coordinator carries these) ─────────────────────────────────────────
  { file: 'lane-drain.mjs',         role: 'drain',         desc: 'numbers + lands the queued lane couples — the drain transport', homes: ['scripts/lane-drain.mjs'] },
  { file: 'drain-push-at-close.mjs',role: 'drain-push',    desc: 'pushes the drained couples at session close', homes: ['scripts/drain-push-at-close.mjs'] },
  { file: 'prune-landed-lanes.mjs', role: 'drain-cleanup', desc: 'prunes landed lane clones after the drain merges them', homes: ['scripts/prune-landed-lanes.mjs'] },
  { file: 'fetch-parked.mjs',       role: 'drain-fetch',   desc: 'fetches the parked PRs the drain re-evaluates each pass', homes: ['scripts/fetch-parked.mjs'] },
  { file: 'pr-state.mjs',           role: 'pr-state',      desc: 'reads PR/label/check state the producer + drain gate on', homes: ['scripts/pr-state.mjs'] },
  { file: 'push-if-green.mjs',      role: 'green-push',    desc: 'the green-gated push the transport uses to advance a lane', homes: ['scripts/push-if-green.mjs'] },
  { file: 'wait-green.mjs',         role: 'green-wait',    desc: 'blocks the transport until the required check is green', homes: ['scripts/wait-green.mjs'] },
  // ── the review transport (CLIs around the policy-tier review-core; the router itself is trust-chain) ──────
  { file: 'review-core-cli.mjs',    role: 'review-cli',    desc: 'CLI wrapper that runs the shared review core in the transport', homes: ['scripts/review-core-cli.mjs'] },
  { file: 'review-detail.mjs',      role: 'review-detail', desc: 'renders the review detail the drain stamps on a parked PR', homes: ['scripts/review-detail.mjs'] },
  { file: 'review-set-label.mjs',   role: 'review-clear',  desc: 'swaps a parked review label (…→accepted) so the drain may merge — the review-clear transport (the WE invariant-2 backstop)', homes: ['scripts/review-set-label.mjs'] },
  { file: 'lane-review.mjs',        role: 'lane-review',   desc: 'runs the lane\'s pre-PR review pass in the transport', homes: ['scripts/lane-review.mjs'] },
];

/** The set of ALL relocatable-engine basenames — the derived matcher input. Frozen. (#2479) */
export const BLAST_RADIUS_ENGINE_BASENAMES = Object.freeze(new Set(BLAST_RADIUS_ENGINE.map((m) => m.file)));

/** Does this repo-relative path hit a high-blast-radius surface? Pure. Matches either a blast-radius PATTERN
 *  (WE-permanent / cross-repo surfaces above) OR a relocatable ENGINE basename (#2479) — the latter so the
 *  surface TRAVELS when the delivery engine is extracted out of we:scripts/, exactly as `isTrustChainPath` does
 *  for the gate-self set. */
export function isBlastRadiusPath(path) {
  const p = String(path || '');
  return BLAST_RADIUS.some((re) => re.test(p)) || BLAST_RADIUS_ENGINE_BASENAMES.has(basenameOf(p));
}

/** The POLICY-CORE trust chain (#2285 v1, re-anchored #2448, narrowed by the #2445 two-tier flip). A diff
 *  touching one of these files edits the very machinery that DECIDES whether the review gate fires and what
 *  clears it — so an *agent* reviewing such a change would be policing an edit to its own leash (a genuine
 *  conflict of interest). These, and ONLY these (plus the statute layer, `isStatutePath`), force a HUMAN
 *  review (`review:human`). The ENGINE tier — the lander, which obeys the gate rather than defining it — is
 *  NOT here: a change there still escalates and runs the full adversarial panel, but a converged agent verdict
 *  may clear it. Every other blast-radius path is agent-reviewable too.
 *
 *  #2448 — the roster (and the basename-based matcher that lets it TRAVEL when the engine is extracted out of
 *  `we:scripts/`, per the #2445 coordinator epic) lives in explicit, versioned config: ./gate-config.mjs.
 *  `isGateSelfPath` is that config's `isPolicyCorePath` under its historical name. See gate-config.mjs for the
 *  two tiers, the extraction contract, and the self-hosting design. */
export const isGateSelfPath = isPolicyCorePath;

/**
 * The advisory CARE-LEVEL an escalated PR carries (#2567, codified `#blast-radius-advisory-care-not-a-gate`,
 * #2563). The reframe: a scored escalation signal (blast-radius / size / dismissed / cross-repo) is
 * NOT a park-gate that routes to a human — it is *care-level information* that tells the reviewer (the AI panel)
 * HOW HARD to look. Care-level dials panel rigor (`panelRigorForCareLevel` in review-core.mjs — rounds / lenses /
 * jurors), never the *route*: a high-care change still gets an agent review, it does not get handed to a human
 * (only gate-self/statute and a non-convergence deadlock do that). Ordered least→most; `none` = no scored signal.
 */
export const CARE_LEVELS = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  ELEVATED: 'elevated',
  HIGH: 'high',
});

/** Care-levels ordered least→most, so a caller can compare / clamp deterministically. Frozen. (#2567) */
export const CARE_LEVEL_ORDER = Object.freeze([CARE_LEVELS.NONE, CARE_LEVELS.LOW, CARE_LEVELS.ELEVATED, CARE_LEVELS.HIGH]);

/**
 * The per-signal CARE WEIGHTS (#2567) — how much each scored escalation signal contributes to the care score,
 * mirroring the strength ordering the rubric already documents (`scoreEscalation` below):
 *   • dismissed-findings — the STRONGEST scored signal (the lane judged its own reviewer's findings away — direct
 *     author-anchoring), and it scales with the count.
 *   • blast-radius — touches system machinery, so a bad merge is far costlier than a leaf edit → elevated alone.
 *   • size / cross-repo — real but weaker scored signals.
 * Tuning knobs (loose to start), kept here so a re-weight is one edit + a test — never scattered.
 */
export const CARE_WEIGHTS = Object.freeze({
  dismissedBase: 3,   // any dismissed finding — the strongest scored signal
  dismissedExtra: 2,  // added when MORE than one finding was dismissed (a pattern, not a one-off)
  blastRadius: 3,     // system-machinery surface — elevated on its own
  size: 2,            // a large diff — humans review these worse, so the panel looks harder
  crossRepo: 2,       // a coordinated multi-repo couple
});

/** Care-score band edges (#2567): score → level. `< low` ⇒ none; `< elevated` ⇒ low; `< high` ⇒ elevated;
 *  `>=` the top edge ⇒ high. Frozen tuning knobs. */
export const CARE_BANDS = Object.freeze({ low: 1, elevated: 3, high: 5 });

/**
 * Derive the advisory CARE-LEVEL for an escalated PR from its `scoreEscalation` signals (#2567). Pure, total.
 * A human-gated change (gate-self / statute — `humanRequired`) is MAXIMUM care (`high`): a human clears it, and
 * the panel that advises the fix should look as hard as it can. Otherwise the scored signals sum by `CARE_WEIGHTS`
 * and fall into a `CARE_BANDS` band. No scored signal at all → `none`. This is advisory ONLY — it dials panel
 * rigor, it never decides route or land (that stays with `decideReviewGate` / `deriveReviewDisposition`).
 * @param {{signals?: object, humanRequired?: boolean}} o - `signals` is the `scoreEscalation` signals object.
 * @returns {'none'|'low'|'elevated'|'high'}
 */
export function deriveCareLevel({ signals = {}, humanRequired = false } = {}) {
  if (humanRequired) return CARE_LEVELS.HIGH;
  const s = signals || {};
  let score = 0;
  if (s.dismissedFindings) score += CARE_WEIGHTS.dismissedBase + (Number(s.dismissedFindings) > 1 ? CARE_WEIGHTS.dismissedExtra : 0);
  if (s.blastRadius) score += CARE_WEIGHTS.blastRadius;
  if (s.size) score += CARE_WEIGHTS.size;
  if (s.crossRepo) score += CARE_WEIGHTS.crossRepo;
  if (score >= CARE_BANDS.high) return CARE_LEVELS.HIGH;
  if (score >= CARE_BANDS.elevated) return CARE_LEVELS.ELEVATED;
  if (score >= CARE_BANDS.low) return CARE_LEVELS.LOW;
  return CARE_LEVELS.NONE;
}

/**
 * Score ONE ready PR against the escalation rubric. Pure. Returns `{ escalate, humanRequired, careLevel, reasons,
 * signals }` — `escalate` is true iff ANY rubric signal fired; `careLevel` (#2567) is the advisory dial derived
 * from the same signals (`deriveCareLevel`); `reasons` is the human-readable rule outcome the drain STAMPS
 * (`escalated: yes/no` + why). Signals (each independent):
 *   • blast-radius — the diff touches a high-blast-radius surface (scripts/, skills, hooks, CI, statute, defs).
 *   • size         — total changed lines ≥ thresholds.diffLines.
 *   • dismissed    — the lane's pre-PR review (#2170) DISMISSED ≥1 finding — the STRONGEST signal (it targets
 *                    author anchoring directly: the lane judged its own reviewer's findings away).
 *   • cross-repo   — an impl+WE couple spanning >1 repo (a coordinated multi-repo change).
 *
 * A PR escalates ONLY for one of these real reasons — there is no random/sampling floor (#xlno40g): a
 * clean, CI-green PR with no scored signal and no dismissed finding reaches no reviewer, it just lands.
 *
 * Also returns `humanRequired` (#2285 v1, narrowed by the #2445 two-tier flip): true iff the diff touches the
 * POLICY tier of the trust chain (`isGateSelfPath`) or the STATUTE layer (`isStatutePath`) — the classes where
 * a human is essential (an agent policing its own leash, or a governance rule a human must ratify). The ENGINE
 * tier (the lander) escalates but is agent-reviewable, so it does NOT set humanRequired. A *classification* of
 * an already-escalating PR (a policy/statute file is always blast-radius too), never a fresh escalation trigger.
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
 *          crossRepo?:boolean, thresholds?:object}} o
 */
export function scoreEscalation({
  changedFiles = [],
  diffLines = 0,
  humanBasisFiles = null,
  dismissedFindings = 0,
  crossRepo = false,
  thresholds = {},
} = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const reasons = [];
  const signals = {};

  // A trust-chain path ALWAYS escalates (even a relocated engine file that no longer matches `^scripts/`) —
  // isTrustChainPath covers both tiers, so the lander always gets an independent review whether or not it also
  // matches a blast-radius pattern.
  const blastFiles = (Array.isArray(changedFiles) ? changedFiles : []).filter((f) => isBlastRadiusPath(f) || isTrustChainPath(f));
  if (blastFiles.length) { signals.blastRadius = blastFiles; reasons.push(`blast-radius (${blastFiles.slice(0, 3).join(', ')}${blastFiles.length > 3 ? ', …' : ''})`); }

  // #2390-review-fix — the human gate scores over the cumulative basis (a self-declared/mis-set stacked `base`
  // can never shrink it), falling back to `changedFiles` when no separate basis is supplied.
  // #2445 two-tier flip — ONLY the POLICY tier (isGateSelfPath) and the STATUTE layer force a human; the ENGINE
  // tier (the lander) escalated via blast-radius above but is agent-reviewable, so it is NOT counted here.
  const gateBasis = Array.isArray(humanBasisFiles) ? humanBasisFiles : (Array.isArray(changedFiles) ? changedFiles : []);
  const gateSelfFiles = gateBasis.filter(isGateSelfPath);
  const statuteFiles = gateBasis.filter(isStatutePath);
  const humanRequired = gateSelfFiles.length > 0 || statuteFiles.length > 0;
  if (gateSelfFiles.length) { signals.gateSelf = gateSelfFiles; reasons.push(`gate-self (${gateSelfFiles.join(', ')}) — human review required`); }
  if (statuteFiles.length) { signals.statute = statuteFiles; reasons.push(`statute (${statuteFiles.join(', ')}) — human review required`); }

  if (Number(diffLines) >= t.diffLines) { signals.size = Number(diffLines); reasons.push(`size (${diffLines} ≥ ${t.diffLines} changed lines)`); }

  if (Number(dismissedFindings) > 0) { signals.dismissedFindings = Number(dismissedFindings); reasons.push(`dismissed-findings (${dismissedFindings} pre-PR review finding(s) the lane dismissed)`); }

  if (crossRepo) { signals.crossRepo = true; reasons.push('cross-repo impl+WE couple'); }

  // #xlno40g — NO random/sampling floor. A PR escalates only for a real reason above (blast-radius, size,
  // dismissed findings, cross-repo) or the human gate below (gate-self / statute). A clean PR whose number
  // happened to be divisible by N no longer parks for nothing — random sampling was found to have no value.

  // #2567 — the advisory CARE-LEVEL, derived from the same signals. ADDITIVE: existing callers that only read
  // escalate/humanRequired/reasons/signals are unchanged; the care-level is the new advisory dial (it tells the
  // AI panel how hard to look — `panelRigorForCareLevel` — and never changes route or land).
  const careLevel = deriveCareLevel({ signals, humanRequired });

  return { escalate: reasons.length > 0, humanRequired, careLevel, reasons, signals };
}

/**
 * #2307 — the deterministic review label the PRODUCER (`pr-land.mjs`) applies at PR-OPEN, from the SAME
 * `scoreEscalation` verdict the drain scores later — so a PR that will need review carries `review:human` /
 * `review:pending` from the start, never only after a drain happens to sweep it (#2281's rule applied to the
 * review dimension). Pure — a producer-time simplification of `decideReviewGate`: besides the fresh rubric
 * score, the ONLY other input that gate weighs is the PR's observed `review:*` labels (a reviewer verdict, or
 * the sticky `review:human` gate), and at open none exist yet — so the outcome collapses to the rubric's own
 * escalate/humanRequired verdict. `null` means no review label to apply (a plain `merge` PR —
 * `ready-to-merge` alone is enough).
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
  // #2567 — the couple's advisory care-level is the STRICTEST (highest) member's, same inherit-the-strictest rule
  // as escalate/humanRequired: an impl+WE couple looks as hard as its most care-worthy half demands.
  const careLevel = members.reduce((max, m) => {
    const lvl = (m && m.careLevel) || CARE_LEVELS.NONE;
    return CARE_LEVEL_ORDER.indexOf(lvl) > CARE_LEVEL_ORDER.indexOf(max) ? lvl : max;
  }, CARE_LEVELS.NONE);
  return { escalate, humanRequired, careLevel, reasons };
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
 * `review:pending` PR through (backlog #2262's documented manual override for a parked PR with no reviewer
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
