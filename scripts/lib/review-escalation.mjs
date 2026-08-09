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
import { createHash } from 'node:crypto';
import { isTrustChainPath, isPolicyCorePath, isPolicySpecPath, isPolicyDerivationPath, basenameOf } from './gate-config.mjs';
import { POLICY_THRESHOLDS } from './review-policy.mjs';
// #x169fqe — the transient lane bookkeeping the reviewed-diff fingerprint excludes, imported rather than
// re-spelled so the fingerprint and the rebase-drop pass that removes the file can never disagree on its name.
import { LANE_MANIFEST } from './rebase-drop-manifest.mjs';

/** The ratified reviewer-verdict labels (#2171). The reviewer's disposition is a LABEL, never comment-parsing:
 *  independent *disposition* (reviewer accepts/rejects) is split from hot-context *fixing* (the author lane). */
export const REVIEW_LABELS = {
  pending: 'review:pending',   // the drain parked this PR — an independent review is owed before merge
  accepted: 'review:accepted', // reviewer accepted → the drain may merge
  changes: 'review:changes',   // reviewer wants changes → the author lane fixes hot-context + re-pushes
  human: 'review:human',       // #2285 v1 — the diff edits the gate's DECLARATIVE LEASH (the contract / roster / invariant suites) or the STATUTE layer; only a HUMAN may clear it. Policy-tier derivation code (#2771/#2785) and the engine tier (#2445) are agent-reviewable
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
 *   • CROSS-REPO surfaces (skills, agent memory — both their `.claude/` link spelling AND their `*-src/` source
 *     trees — hooks, CI, statute) already anchor with `(^|\/)`, so they match a relocated copy for free —
 *     `plateau-app/.claude/skills/drain/SKILL.md` and `plateau-app/skills-src/…` both trip, just like the WE
 *     spellings do. No travel work is needed for these.
 *   • WE-PERMANENT surfaces stay `^`-anchored on purpose: the standards defs (`src/_data/…json`) live in WE
 *     forever (WE holds the standard), and `^scripts\/` escalates every WE script WHILE it is in WE. The
 *     RELOCATABLE delivery-engine scripts (pr-land, lane-drain, …) also match `^scripts\/` while here, but that
 *     match is lost the moment #2445 extracts them out of we:scripts/ — so those, and only those, ALSO travel by
 *     basename via `BLAST_RADIUS_ENGINE` below. WE-only scripts (standards/backlog/memory/conformance/generators)
 *     are deliberately NOT registered there: WE is their permanent home, `^scripts\/` is the correct matcher for
 *     them, and there is nowhere for them to travel to.
 *
 *  MATCH THE SOURCE TREE, AND THE SYMLINK NODE ITSELF (#2909). In WE both agent-behaviour trees were relocated
 *  out of `.claude/` by #2266 and left behind a SYMLINK: `.claude/skills → ../skills-src` and
 *  `.claude/agent-memory → ../agent-memory-src`. Git tracks a symlink as a leaf BLOB and never DESCENDS it, so
 *  no diff path can ever begin with `.claude/skills/…` in WE — every real edit lands as `skills-src/…` /
 *  `agent-memory-src/…`. The `.claude/skills/` entry therefore matched NOTHING in WE from 2026-07-04 until the
 *  source spellings were added, and PR #1040 rewrote the land bar and merged with no `review:*` label at all.
 *
 *  FOUR spellings must all score, and the two anchors below cover all four — each anchor pairs the two trees,
 *  and each makes its trailing separator OPTIONAL so the bare LEAF matches as well as anything under it:
 *   • `skills-src/…` / `agent-memory-src/…` — the SOURCE trees; what a WE diff actually carries.
 *   • `skills-src` / `agent-memory-src` with NO trailing slash — the source tree as a LEAF diff path. Replacing
 *     a real directory with a link (`skills-src → ../shared-skills`) is a single diff path at mode 120000, and
 *     it swaps the whole operating-procedure tree exactly like repointing the `.claude/` link does.
 *   • `…/.claude/skills/…` — the link spelling as a REAL tracked directory (plateau-app has 2 files there),
 *     live cross-repo via the `(^|\/)` anchor. Kept: deleting it would uncover the siblings.
 *   • `.claude/skills` / `.claude/agent-memory` with NO trailing slash — the symlink BLOB itself. Git cannot
 *     descend a link, but it absolutely emits the LINK NODE as a diff path when the link is created, REPOINTED
 *     or DELETED. `.claude/skills → ../somewhere-else` is a one-line commit that swaps the entire operating-
 *     procedure tree the agent loads, and before the `(\/|$)` alternative below it scored nothing at all.
 *  Hence `(skills|agent-memory)` alternation + `(\/|$)` on BOTH anchors, rather than one `…\/` regex per tree:
 *  the trailing separator is optional (so a leaf blob matches) and the two trees always share an anchor (so
 *  neither can be registered without the other). The `.claude/` half is the `(^|\/)\.claude\/`-scoped anchor
 *  #2909's Done-when bullet 4 proposed, kept narrow to the two procedure directories so it does NOT sweep in
 *  `.claude/settings.json` / `.claude/commands/` — those are real gaps, and they are OPEN: how wide the
 *  `.claude/` anchor should be (enumerate the named paths, or invert it to default-deny with an exemption list)
 *  is a separately-filed design call, and the build item that registers whatever line that call draws waits on
 *  its ruling. Not a side effect of this one. */
const BLAST_RADIUS = [
  /^scripts\//,                              // build/CI/merge tooling (WHILE in WE; relocatable engine files also travel by basename — see BLAST_RADIUS_ENGINE)
  /(^|\/)\.claude\/(skills|agent-memory)(\/|$)/, // both agent-behaviour trees under the link spelling: a REAL dir (plateau-app) AND the bare symlink blob (repoint/delete) — travels cross-repo via (^|\/)
  /(^|\/)(skills|agent-memory)-src(\/|$)/,   // …and WE's post-#2266 SOURCE home for the same two trees — the spelling WE diffs actually carry, plus the bare leaf (dir→link swap). The surface PR #1040 slipped through
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
 *  conflict of interest). NO LONGER THE HUMAN TRIGGER (#2771/#2785): this tier is now split, and only its
 *  DECLARATIVE-LEASH half (`isDeclarativeLeashPath`, below) forces `review:human` — the derivation-code half
 *  escalates to the independent committee. `isGateSelfPath` survives as the "is this the policy tier?" question
 *  its non-rubric callers actually ask (the readiness deny-list, the roster tests). The ENGINE tier — the
 *  lander, which obeys the gate rather than defining it — was never here: a change there still escalates and
 *  runs the full adversarial panel, but a converged agent verdict may clear it.
 *
 *  #2448 — the roster (and the basename-based matcher that lets it TRAVEL when the engine is extracted out of
 *  `we:scripts/`, per the #2445 coordinator epic) lives in explicit, versioned config: ./gate-config.mjs.
 *  `isGateSelfPath` is that config's `isPolicyCorePath` under its historical name. See gate-config.mjs for the
 *  two tiers, the extraction contract, and the self-hosting design. */
export const isGateSelfPath = isPolicyCorePath;

/**
 * #2771/#2785 — THE DECLARATIVE LEASH, the narrowed `review:human` path trigger. `isGateSelfPath` above is the
 * whole POLICY TIER (it still answers "is this the policy tier?" for the callers that ask that, e.g. the
 * readiness deny-list); this is the half of that tier for which a HUMAN is essential: the machine-diffable
 * contract, the roster, and the invariant / conformance suites. Those files ARE the encoded policy, so there is
 * no behaviour-preserving edit to them. The other half — the derivation CODE (`isPolicyDerivationPath`) — still
 * escalates but routes to the sized independent committee. Re-exported here under the leash name so callers read
 * the rubric's vocabulary; the roster and the classification live in gate-config.mjs.
 */
export const isDeclarativeLeashPath = isPolicySpecPath;
export { isPolicyDerivationPath, isPolicySpecPath };

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
 *   • blast-radius — the diff touches a high-blast-radius surface (scripts/, the agent-behaviour trees — skills
 *                    and agent memory, in both their `.claude/` link and `*-src/` source spellings — hooks, CI,
 *                    statute, standards defs).
 *   • size         — total changed lines ≥ thresholds.diffLines.
 *   • dismissed    — the lane's pre-PR review (#2170) DISMISSED ≥1 finding — the STRONGEST signal (it targets
 *                    author anchoring directly: the lane judged its own reviewer's findings away).
 *   • cross-repo   — an impl+WE couple spanning >1 repo (a coordinated multi-repo change).
 *
 * A PR escalates ONLY for one of these real reasons — there is no random/sampling floor (#xlno40g): a
 * clean, CI-green PR with no scored signal and no dismissed finding reaches no reviewer, it just lands.
 *
 * Also returns `humanRequired` (#2285 v1, narrowed by the #2445 two-tier flip and again by #2771/#2785): true
 * iff the diff touches the DECLARATIVE LEASH (`isDeclarativeLeashPath` — the contract, the roster, the
 * invariant/conformance suites) or the STATUTE layer (`isStatutePath` — a governance rule a human must ratify).
 * Those are the classes where genuine human judgment is essential. Everything else escalates but is
 * agent-reviewable and does NOT set humanRequired: the ENGINE tier (the lander) and the policy tier's DERIVATION
 * CODE (#2771 Fork A — the rubric, the router, the loader, the seams). A *classification* of an already-escalating
 * PR (a policy/statute file is always blast-radius too), never a fresh escalation trigger.
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
 * #2890 — `diffHunks` (base-vs-head DIFF CONTENT, not just file names + a line count) is accepted and carried
 * through to the returned verdict unchanged. This rubric does NOT read it for any signal today — that is
 * deliberate: #2890 is PURE PLUMBING, the shared precondition #2839's `assertNotPrincipleAndImpl` and #2840's
 * `isPrincipleSurface` need (both are content-reading detectors — a statute-anchor-body edit or a
 * pre-existing-marker edit are base-vs-head FACTS no file name or line count can answer). Threading it here
 * now, ahead of either detector landing, means neither follow-on has to touch this signature again — they
 * only add a term that reads `diffHunks`.
 *
 * #2890-review-fix finding 1 — THE `null` CONTRACT, and why it is `null` and not `''`. Every producer of this
 * signal (`computeNetDiffText`, `computeProposedFileDiffText`) returns `text:''` on EVERY failure path
 * (`exec-contract`, `ref-unresolved`, `diff-failed`, `diff-too-large`, no local/sibling clone) — the same `''`
 * a genuinely content-free diff yields. Passing `.text` through would collapse "NOT COMPUTED" into "COMPUTED,
 * EMPTY", and in the drain that happens exactly where `changedFiles` STILL populates (the `gh pr view --json
 * files` fallback): a content-reading detector would then see a real file list beside a fake-empty content
 * signal and conclude `principleTouch === false` — a silent fail-open on the precise class #2839/#2840 exist to
 * catch. So the contract here is:
 *   • `null`  — NOT COMPUTED. A detector MUST NOT read a clearance from this; treat it as unknown and
 *               over-fire (escalate), never as "no principle touch". `.includes()` on it THROWS, loudly, which
 *               is the point: there is no way to silently mistake it for an empty diff.
 *   • `''`    — COMPUTED, and the base-vs-head content is genuinely empty (mode-only / rename-only diff).
 *   • string  — COMPUTED unified-diff text.
 * Callers must never hand-roll the `scored ? text : null` ternary — use `diffHunksFrom(netDiff)` below, which
 * is the single place that maps a `{text, scored}` producer result onto this contract. Anything that is not a
 * string is normalized to `null` here, so a caller that regresses to passing a raw result OBJECT lands on the
 * safe side rather than stringifying garbage into the signal. A caller with no diff text in hand (most
 * existing callers, still) passes nothing and gets `null`.
 *
 * #2890-review-fix finding 4 — WHICH FILE LIST THE HUNKS PAIR WITH. `diffHunks` is always CUMULATIVE
 * (`mergeBase(origin/main, head)…head`), while `changedFiles` may be DE-INFLATED to `baseRev…head` for a
 * stacked couple (#2390). They are therefore NOT the same basis and must not be zipped together. The verdict
 * exposes `diffHunksBasisFiles` — the file list computed on the SAME basis as the hunks (`humanBasisFiles`,
 * falling back to `changedFiles` in the non-stacked case where the two are identical) — so a detector reading
 * hunk content pairs it with THAT list, never with `changedFiles`. The two travel together on one object
 * precisely so the pairing cannot be got wrong by reading the wrong field.
 *
 * #2890-review-r2 finding 5 — and it is handed back as PLAIN PATHS (`plainDiffPath`), not in git's display
 * encoding. `humanBasisFiles` is `parseNumstat` output, where a rename renders `old.md => new.md` and a
 * non-ASCII path is C-quoted (`"caf\303\251.md"`) — this repo documents that exact trap twice (see
 * `computeNetDiffPaths`'s JSDoc and `we:skills-src/review/SKILL.md`). Publishing it as the pairing contract
 * would have shipped a list that CANNOT match hunk headers, which spell plain paths (`b/docs/agent/x.md`): a
 * renamed statute file would silently pair with nothing. The scoring terms above still read the raw
 * display-encoded list — normalizing THOSE is a real behaviour change to the gate and is not smuggled in here.
 *

 * @param {{changedFiles?:string[], diffLines?:number, humanBasisFiles?:string[]|null, dismissedFindings?:number,
 *          crossRepo?:boolean, thresholds?:object, diffHunks?:string|null}} o
 */
/**
 * #2890-review-r2 finding 5 — ONE numstat display-encoded entry → the PLAIN new path.
 *
 * `git diff --numstat` (which is what `parseNumstat`, and therefore `changedFiles`/`humanBasisFiles`, is built
 * on) prints paths for HUMANS, not for matching. Measured against real git 2.50.1, the four shapes are:
 *   `plain.md`                                     → `plain.md`            (unchanged)
 *   `"caf\303\251.md"`                             → `café.md`             (C-quoted, octal bytes)
 *   `docs/agent/{old-name.md => new-name.md}`      → `docs/agent/new-name.md`   (compact brace rename)
 *   `dir/{sub => }/thing.md`                       → `dir/thing.md`        (brace, empty new side)
 *   `"docs/caf\303\251.md" => "docs/caf\303\2512.md"` → `docs/café2.md`    (quoted rename — NOT braced)
 * The new path is taken because that is what `computeNetDiffPaths` reports and what a hunk header spells.
 *
 * RESIDUAL, stated rather than hidden: the un-braced `old => new` form is AMBIGUOUS when a path itself contains
 * ` => `. Real git emits `a => b.md => c => d.md` for renaming `a => b.md` to `c => d.md` and provides no way
 * to re-split it (verified) — `--numstat -z` is the only unambiguous source, and moving the whole scoring path
 * onto it is a gate-behaviour change, not this item's plumbing. Such a path also always renders UNQUOTED, so
 * the split here is only attempted when the entry is not quoted-rename shaped, and the result is a best-effort
 * suffix — never worse than the display string it replaces.
 * @param {string} entry one `parseNumstat` changed-file entry
 * @returns {string} the plain (unquoted, un-renamed) new path
 */
export function plainDiffPath(entry) {
  if (typeof entry !== 'string' || !entry) return entry;
  // Quoted rename: git quotes each SIDE in full and never uses the brace form when quoting is needed.
  const quotedRename = entry.match(/^(".*")\s=>\s(".*")$/);
  if (quotedRename) return unquoteGitPath(quotedRename[2]);
  // Compact brace rename — `<prefix>{<old> => <new>}<suffix>`; either side may be empty. Non-greedy on the old
  // side so the FIRST `{…}` group wins (git emits at most one).
  const braced = entry.match(/^(.*?)\{(.*?) => (.*?)\}(.*)$/);
  if (braced) return collapseSlashes(`${braced[1]}${braced[3]}${braced[4]}`);
  // Plain rename (no quoting, no common prefix/suffix). See the residual above for the ` => `-in-path case.
  const idx = entry.indexOf(' => ');
  if (idx !== -1) return unquoteGitPath(entry.slice(idx + 4));
  return unquoteGitPath(entry);
}

// `dir/{sub => }/thing.md` → `dir/` + `` + `/thing.md` → `dir//thing.md`; git's own rendering of the same
// rename as a plain path has one slash.
function collapseSlashes(p) { return p.replace(/\/{2,}/g, '/'); }

/**
 * Decode git's C-quoting (`core.quotePath`): a path with non-ASCII or control bytes is wrapped in `"` with each
 * byte escaped as `\NNN` OCTAL, plus the usual `\n`/`\t`/`\\`/`\"` escapes. The octal escapes are BYTES of the
 * UTF-8 encoding, so they must be reassembled as bytes and decoded once — decoding each `\303` to a codepoint
 * would give mojibake (`cafÃ©`). An unquoted string passes through untouched.
 */
function unquoteGitPath(s) {
  if (typeof s !== 'string' || s.length < 2 || s[0] !== '"' || s[s.length - 1] !== '"') return s;
  const body = s.slice(1, -1);
  const bytes = [];
  const simple = { n: 0x0a, t: 0x09, r: 0x0d, f: 0x0c, b: 0x08, v: 0x0b, a: 0x07, '\\': 0x5c, '"': 0x22 };
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c !== '\\') { for (const b of Buffer.from(c, 'utf8')) bytes.push(b); continue; }
    const next = body[i + 1];
    const octal = body.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(octal)) { bytes.push(parseInt(octal, 8)); i += 3; continue; }
    if (next !== undefined && Object.prototype.hasOwnProperty.call(simple, next)) { bytes.push(simple[next]); i += 1; continue; }
    bytes.push(0x5c); // a lone backslash git did not escape — keep it rather than eat the next char
  }
  return Buffer.from(bytes).toString('utf8');
}

export function scoreEscalation({
  changedFiles = [],
  diffLines = 0,
  humanBasisFiles = null,
  dismissedFindings = 0,
  crossRepo = false,
  thresholds = {},
  diffHunks = null,
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
  // #2771/#2785 — the POLICY tier is SPLIT. Only the DECLARATIVE LEASH (`isDeclarativeLeashPath`: the contract,
  // the roster, the invariant/conformance suites) still forces a human; the DERIVATION CODE that realizes it
  // escalates to the sized independent committee instead. Both sets come from the ONE roster in gate-config.mjs.
  const gateBasis = Array.isArray(humanBasisFiles) ? humanBasisFiles : (Array.isArray(changedFiles) ? changedFiles : []);
  const leashFiles = gateBasis.filter(isDeclarativeLeashPath);
  const derivationFiles = gateBasis.filter(isPolicyDerivationPath);
  const statuteFiles = gateBasis.filter(isStatutePath);
  // The STATUTE term is UNCHANGED by this narrowing (#2771 Fork A): every statute touch still forces a human,
  // exactly as before. Only the first term moved — from the whole policy tier to its declarative-leash half.
  const humanRequired = leashFiles.length > 0 || statuteFiles.length > 0;
  if (leashFiles.length) { signals.gateSelf = leashFiles; reasons.push(`gate-self (${leashFiles.join(', ')}) — declarative leash, human review required`); }
  // The derivation half keeps its own signal + reason so the PR still ESCALATES on a stacked basis where the
  // file is in `humanBasisFiles` but not in the own-delta `changedFiles` that fed the blast-radius signal above.
  // Its token's clearance is `agent` in the contract, so the panel may CLEAR it — that is the whole narrowing.
  if (derivationFiles.length) { signals.gateDerivation = derivationFiles; reasons.push(`gate-derivation (${derivationFiles.join(', ')}) — gate derivation code, independent committee review`); }
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

  // #2890 — passthrough, not a signal: `producerReviewLabel(score)` and any other caller that receives this
  // verdict object gets `diffHunks` for free, without a second signature change, once a future detector reads it.
  // #2890-review-fix finding 1 — anything that is not a string collapses to `null` (NOT COMPUTED); `''` is
  // reserved for "computed, genuinely empty". A detector must branch on `=== null` before reading content.
  const hunks = typeof diffHunks === 'string' ? diffHunks : null;
  // #2890-review-fix finding 4 — the file list on the SAME (cumulative) basis as `hunks`. `null` when there are
  // no hunks, so a detector can never pair a real file list with an absent content signal.
  // #2890-review-r2 finding 5 — as PLAIN paths, the only spelling that can match a hunk header.
  const diffHunksBasisFiles = hunks === null ? null : gateBasis.map(plainDiffPath);
  return { escalate: reasons.length > 0, humanRequired, careLevel, reasons, signals, diffHunks: hunks, diffHunksBasisFiles };
}

/**
 * #2890-review-fix finding 1 — the ONE mapping from a diff-text producer's result onto `scoreEscalation`'s
 * `diffHunks` contract. Every producer (`computeNetDiffText`, `computeNetDiffPaths`'s sibling
 * `computeProposedFileDiffText`) returns `{text, scored, reason?}` and sets `text:''` on EVERY failure path, so
 * `.text` alone cannot distinguish "not computed" from "computed, empty". This collapses that correctly:
 * `scored` ⇒ the text (possibly `''`), otherwise `null` (NOT COMPUTED).
 *
 * Call sites must use THIS rather than writing `netDiff.scored ? netDiff.text : null` inline — the ternary is
 * exactly the thing the review found missing at both call sites. A missing/malformed result is `null`, never
 * `''`.
 *
 * WHAT ACTUALLY HOLDS THAT SHUT (#2890-review-r2 finding 4 — the earlier claim here, that "a third call site
 * cannot reintroduce the bug", was FALSE and is withdrawn). A helper existing does not stop anyone hand-rolling
 * the ternary, and the source-level grep that backed the claim was measured against 12 regression shapes and
 * caught exactly two of them (`diffHunks: x.text`, `diffHunks: x.text ?? ''`) in two named files — not a
 * ternary in either polarity, not `x?.text`, not a destructured `text`, not `v.netDiff.text`. The real defences
 * are structural, and each is worth exactly what it is:
 *   1. `computeNetDiffSignals` (merge-ai-prs.mjs) is the ONE derivation both production call sites use, and it
 *      applies this helper itself. Its behaviour — a failed text diff yields `diffHunks:null` while
 *      `changedFiles` still populates — is pinned by tests that call it, not by a regex.
 *   2. `pr-land.mjs` no longer imports `computeNetDiffText` at all, so the raw `{text}` producer is not even in
 *      scope there to be mis-mapped; a source guard keeps that import out.
 *   3. `scoreEscalation` normalizes any non-string to `null`, so passing a raw result OBJECT fails safe.
 * A genuinely NEW call site in a THIRD file remains unguarded by any of this — it is caught by review, not by
 * a test. Say that plainly rather than claiming coverage that does not exist.
 * @param {{text?:string, scored?:boolean}|null|undefined} netDiff a `computeNetDiffText`-shaped result
 * @returns {string|null} the diff text when it was actually computed, else `null`
 */
export function diffHunksFrom(netDiff) {
  if (!netDiff || typeof netDiff !== 'object') return null;
  if (netDiff.scored !== true) return null;
  return typeof netDiff.text === 'string' ? netDiff.text : null;
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
 *
 * #2890 — called with the FULL `scoreEscalation` return, so `score.diffHunks` (the base-vs-head diff content)
 * rides along unused: this function's label derivation is escalate/humanRequired-only and stays that way.
 * @param {{escalate:boolean, humanRequired?:boolean, diffHunks?:string|null}} score
 * @returns {string|null}
 */
export function producerReviewLabel({ escalate, humanRequired = false } = {}) {
  if (humanRequired) return REVIEW_LABELS.human;
  if (escalate) return REVIEW_LABELS.pending;
  return null;
}

/**
 * The ROSTER-TIMING strictness values (#2635 / #2633 knob #4). Mirrors the value space of the care→jury
 * contract's `careJury.rosterTimingMode` (`./review-policy.contract.json`) — kept here, on the leaf the producer
 * (`pr-land.mjs`) and `reconcileRoster` below both read, so the two never drift on what a mode means:
 *   • `up-front`    — the STRICT default: the whole roster is bound before any juror runs, so a real-diff
 *                     expansion PAST what was pre-registered at prepare is drift that re-triggers HUMAN alignment
 *                     (never a silent rebind).
 *   • `incremental` — the reserved lenient alternative: jurors are added as care escalates mid-run, so an
 *                     expansion binds silently (no re-alignment).
 */
export const ROSTER_TIMING = Object.freeze({ UP_FRONT: 'up-front', INCREMENTAL: 'incremental' });

/** Normalize a lens list to unique, non-empty, trimmed strings, preserving first-seen order. Pure, internal. */
function normalizeLenses(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string') continue;
    const lens = raw.trim();
    if (!lens || seen.has(lens)) continue;
    seen.add(lens);
    out.push(lens);
  }
  return out;
}

/**
 * #2635 — BIND and RECONCILE the jury roster at PR-open against the REAL diff. Pure.
 *
 * At prepare, a jury is pre-registered from the item's predicted scope (its charter). At PR-open the roster is
 * RE-picked from the real diff (`recomputed` — the caller runs the same cheap `scoreEscalation` care→roster pass
 * over the ACTUAL `changedFiles`), because the predicted scope often misses an axis the real diff touches (the
 * "a small script fix that moves a UI file needs the a11y + visual jurors nobody picked" case). This reconciles
 * the pre-registered set against that recompute:
 *
 *   • `effective` — the UNION of the pre-registered lenses and the recomputed lenses (pre-registered first, in
 *     order, then any lens the real diff newly earned). A pre-registered seat is NEVER silently dropped; the real
 *     diff only ever ADDS perspective. `removed` (pre-registered lenses the recompute no longer earns) is reported
 *     for the ledger but stays SEATED in `effective` — losing a charter-registered juror is not this step's call.
 *   • `added` — the recomputed lenses NOT in the pre-registered set: the expansion past registration.
 *   • `expanded` — `added.length > 0`.
 *   • `humanAlignmentRequired` — per the settled default, an expansion past pre-registration under the STRICT
 *     `up-front` timing re-triggers HUMAN alignment (not a silent rebind), so a human re-confirms a roster the
 *     charter did not anticipate. Under the lenient `incremental` timing the expansion binds silently, so it is
 *     false. The caller folds this into the producer review label (→ `review:human`) and trails `reasons` in the
 *     jury ledger / PR body.
 *
 * NO pre-registered set (`preRegistered == null`) is the pre-charter case (before a prepare-time slice records a
 * roster to reconcile against): there is nothing to have drifted past, so this is a pure BIND — `effective` =
 * recomputed, `expanded` = false, no re-alignment. The re-trigger is dormant until a pre-registered roster exists.
 *
 * @param {{preRegistered?: string[]|null, recomputed?: string[], mode?: string}} o
 * @returns {{effective: string[], added: string[], removed: string[], expanded: boolean,
 *   humanAlignmentRequired: boolean, mode: string, reasons: string[]}}
 */
export function reconcileRoster({ preRegistered = null, recomputed = [], mode = ROSTER_TIMING.UP_FRONT } = {}) {
  const recomputedLenses = normalizeLenses(recomputed);
  const timing = mode === ROSTER_TIMING.INCREMENTAL ? ROSTER_TIMING.INCREMENTAL : ROSTER_TIMING.UP_FRONT;

  // No pre-registered roster to reconcile against — a pure bind of the real-diff roster (nothing drifted past).
  if (preRegistered == null) {
    return { effective: recomputedLenses, added: [], removed: [], expanded: false, humanAlignmentRequired: false, mode: timing, reasons: [] };
  }

  const preLenses = normalizeLenses(preRegistered);
  const preSet = new Set(preLenses);
  const recSet = new Set(recomputedLenses);
  const added = recomputedLenses.filter((l) => !preSet.has(l));
  const removed = preLenses.filter((l) => !recSet.has(l));
  // The union: pre-registered seats first (never dropped), then the lenses the real diff newly earned.
  const effective = [...preLenses, ...added];
  const expanded = added.length > 0;
  const humanAlignmentRequired = expanded && timing === ROSTER_TIMING.UP_FRONT;
  const reasons = [];
  if (expanded) {
    reasons.push(
      humanAlignmentRequired
        ? `jury roster expanded past pre-registration (added ${added.join(', ')}) — re-triggering human alignment (${timing})`
        : `jury roster expanded past pre-registration (added ${added.join(', ')}) — bound incrementally without re-alignment`,
    );
  }
  return { effective, added, removed, expanded, humanAlignmentRequired, mode: timing, reasons };
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
 * THE ONE agent-clearable partition (INVARIANT 2 / #2439) — split a discovered parked-PR set into the
 * AGENT-CLEARABLE set (a verified label array that does NOT carry `review:human`), the SKIPPED `review:human`
 * set (a human's to clear — conflict of interest), and the label-UNVERIFIED set (no labels array at all: its
 * labels could not be read, so we cannot PROVE it is not a `review:human` PR → never act on it). PURE,
 * FAIL-CLOSED. The human check runs BEFORE anything else, so a PR carrying human is always skipped as human.
 *
 * This is the codebase's most safety-critical filter, so it is single-sourced HERE and shared by both the
 * convergence workflow (`review-parked-prs.mjs`) and the scheduled runner (`review-runner-core.mjs`) — a copy
 * cannot drift if there is no copy (#2823 mirror-instead-of-import). Any caller-specific NARROWING (e.g. the
 * runner routes only the `review:pending` class) is a caller-side filter over the returned `clearable`, never a
 * second partition. Each `clearable` entry carries its verified `labels` so a caller can apply that filter.
 *
 * @param {Array<{pr?:(number|string), number?:(number|string), repo?:string, labels?:Array}>} prs
 * @returns {{ clearable: Array<{pr:number,repo:string,labels:Array}>,
 *             skippedHuman: Array<{pr:number,repo:string}>,
 *             skippedUnverified: Array<{pr:number,repo:string}> }}
 */
export function partitionAgentClearable(prs) {
  const clearable = [];
  const skippedHuman = [];
  const skippedUnverified = [];
  for (const item of Array.isArray(prs) ? prs : []) {
    const pr = Number(item && (item.pr != null ? item.pr : item.number));
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const repo = (item && typeof item.repo === 'string' && item.repo) ? item.repo : 'we';
    if (!Array.isArray(item.labels)) { skippedUnverified.push({ pr, repo }); continue; }
    if (hasReviewLabel(item.labels, REVIEW_LABELS.human)) { skippedHuman.push({ pr, repo }); continue; }
    clearable.push({ pr, repo, labels: item.labels });
  }
  return { clearable, skippedHuman, skippedUnverified };
}

/**
 * #2409 — the machine-readable marker that records WHICH commit-set a `review:accepted` verdict actually
 * covered. `review-set-label.mjs` stamps it into the durable accept comment at the moment it applies
 * `review:accepted`, capturing the PR's head SHA THEN (the tree the reviewer looked at). The drain reads it
 * back at land (`parseReviewedSha`) and refuses to honour a stale acceptance whose head has since advanced.
 * A comment marker (not the local baseline cache) is the right home: acceptance and the drain can run on
 * different machines, and the accept is a discrete, durable, cross-machine event — unlike the machine-scoped
 * first-drain-sighting baseline.
 */
export const REVIEWED_SHA_MARKER = 'reviewed-sha';
const REVIEWED_SHA_RE = new RegExp(`<!--\\s*${REVIEWED_SHA_MARKER}:\\s*([0-9a-fA-F]{7,40})\\s*-->`, 'g');

/** Build the reviewed-commit marker line for a full/abbrev git SHA. Pure. Non-hex/empty input → '' (nothing
 *  to stamp — the gate then fails OPEN, never on a garbage marker). */
export function buildReviewedShaMarker(sha) {
  const s = typeof sha === 'string' ? sha.trim() : '';
  return /^[0-9a-fA-F]{7,40}$/.test(s) ? `<!-- ${REVIEWED_SHA_MARKER}: ${s.toLowerCase()} -->` : '';
}

/**
 * Extract the reviewed SHA a `review:accepted` verdict covered from a PR's comments. Given the raw
 * `gh pr view --json comments` array (tolerant of a missing/odd shape), return the SHA of the LATEST marker
 * (most recent accept wins — a re-accept after a fix stamps a fresh SHA), or `null` when none is present
 * (accept predates this gate, or was applied out-of-band → the gate fails OPEN). Pure — no I/O.
 *
 * RESIDUAL (be honest — this is a trust signal): the marker is an ordinary PR comment, and this parse takes
 * the latest marker from ANY author. An actor who can comment on a PR that already carries `review:accepted`
 * could post a marker matching the current head and forge "coverage," defeating the gate for a ride-in commit.
 * Accepted under the single-tenant constellation trust model (the same posture as the sibling gates' fail-open
 * residuals); a hardened home would bind the marker to the label-applying actor / an immutable check-run, not a
 * free-form comment. Not defended here.
 */
export function parseReviewedSha(comments) {
  let latest = null;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    REVIEWED_SHA_RE.lastIndex = 0;
    while ((m = REVIEWED_SHA_RE.exec(body)) !== null) latest = m[1].toLowerCase();
  }
  return latest;
}

/**
 * #x9xqexm (round-2 review, major 3) — WHICH `index <old>..<new>` LINES MAY NOT BE DROPPED. Both fingerprints
 * below drop blob-pair headers on the stated grounds that they "restate the hashes of content that is ALREADY in
 * the diff body". For a BINARY file that premise is provably false: `computeNetDiffText` runs `git diff` without
 * `--binary`, so the whole body of a binary section is the single constant sentence `Binary files … differ`,
 * IDENTICAL for every possible payload. Dropping the `index` line there erases the only carrier of the content,
 * and two totally different binaries hash the same (reproduced: a full payload swap left BOTH digests unchanged).
 *
 * That was inert while the strict digest changed on every rebase, so its escape never fired. #x9xqexm's
 * contribution digest is DESIGNED to fire across a rebase, which makes it live: one push combining a
 * rebase-shaped text move with a binary swap would otherwise read as `covers: true`.
 *
 * So: an `index` line is dropped ONLY when its file section carries a textual body. In a section that git
 * rendered as binary (`Binary files … differ`, or `GIT binary patch` if a caller ever passes `--binary`) the
 * blob pair IS the content and is hashed. Costs nothing on the text path — for a diff with no binary section the
 * returned set is empty and both digests are byte-for-byte what they were.
 * @param {string[]} lines - the raw diff already split on '\n'
 * @returns {Set<number>} indices into `lines` of `index` lines that MUST be kept
 */
function binaryIndexLines(lines) {
  const keep = new Set();
  let pending = [];
  let binary = false;
  const flush = () => { if (binary) for (const i of pending) keep.add(i); pending = []; binary = false; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) { flush(); continue; }
    if (/^index [0-9a-f]+\.\.[0-9a-f]+/.test(line)) { pending.push(i); continue; }
    // Column 0 is unambiguous: a `+`/`-`/` ` line can never be mistaken for git's own binary notice.
    if ((line.startsWith('Binary files ') && line.endsWith(' differ')) || line === 'GIT binary patch') binary = true;
  }
  flush();
  return keep;
}

/**
 * #x169fqe — THE REVIEWED-DIFF FINGERPRINT: a stable digest of the content a reviewer actually judged, so an
 * accept can be checked against CONTENT rather than against the commit that happened to carry it.
 *
 * EXACTLY TWO THINGS ARE EXCLUDED. Every exclusion is a potential COLLISION — two materially different diffs
 * hashing the same — so the list is kept as short as the problem allows, and each entry has to earn its place:
 *   • `index <old>..<new> <mode>` lines — git blob-pair headers, EXCEPT in a binary file section, where they are
 *     the only carrier of the content (`binaryIndexLines`, #x9xqexm round-2 major 3). For a text section they
 *     restate the hashes of content that is ALREADY in the diff body; identical bodies imply identical blobs, so
 *     dropping them removes noise, not signal. This is the one that makes a rebase recognisable at all.
 *   • the ROOT `.lane-manifest.json` file section — the transient lane bookkeeping the drain's rebase-drop pass
 *     exists to remove (`LANE_MANIFEST`, rebase-drop-manifest.mjs). Never review-worthy, and its removal is
 *     precisely the mechanical edit that was invalidating accepts.
 *
 * THE ROOT MATCH IS EXACT, NOT A SUBSTRING (PR #1086 review, blocker 1). The first cut tested
 * `line.includes('/' + LANE_MANIFEST)`, which also matched a NESTED file — `some/dir/.lane-manifest.json` — so a
 * ride-in commit adding a file at that suffix had its whole section dropped from both sides and collided with a
 * diff that never contained it (reproduced: both sides hashed identically and the gate returned `covers: true`).
 * Only git's exact root-file header is skipped now. Any other spelling simply is not skipped, which changes the
 * fingerprint and costs a false re-park — the safe direction.
 *
 * NOTHING ELSE is normalized away, and in particular NOT trailing whitespace (PR #1086 review, blocker 2). The
 * first cut stripped it from every line including `+`/`-` content, so a ride-in that changed ONLY a semantically
 * meaningful trailing space — a markdown hard break, a fixture, a `.patch` file — collided. Whitespace is
 * content. Hunk headers (`@@`) stay too, because a changed line NUMBER means the surrounding file moved and the
 * reviewer's reading of it may no longer hold. File modes, renames, CRLF, and every `+`/`-` line stay. If a
 * rebase changes any of those, the fingerprint changes and the accept correctly goes stale.
 *
 * @param {string|null|undefined} diffText - raw unified diff, or a pre-computed 64-hex fingerprint. THE
 *   IDEMPOTENCE SHORTCUT BELOW ASSUMES a caller only ever passes real `gh pr diff` output (which always carries
 *   `diff --git` headers) or a fingerprint this function produced. Do NOT pass untrusted free-form text: a
 *   64-hex-shaped string would be taken as an already-computed digest rather than hashed.
 * @returns {string|null} a 64-char lowercase sha256, or `null` for absent/unusable input (→ fail closed).
 */
export function normalizeDiffFingerprint(diffText) {
  if (typeof diffText !== 'string') return null;
  const trimmed = diffText.trim();
  if (!trimmed) return null;
  // Idempotent on an already-hashed value, so `acceptanceCoversHead` accepts either a raw diff or a stored digest.
  if (/^[0-9a-f]{64}$/.test(trimmed)) return trimmed;
  // The EXACT header git emits for the repo-root manifest, whatever the change kind (add/modify/delete all carry
  // both sides). An exact-equality test cannot be widened by a crafted path the way a substring test was.
  const MANIFEST_HEADER = `diff --git a/${LANE_MANIFEST} b/${LANE_MANIFEST}`;
  // SPLIT THE RAW TEXT, NOT THE TRIMMED COPY (PR #1086 review, blocker 2 — second pass). Trimming the whole diff
  // strips trailing whitespace off the LAST line, so a ride-in whose only change was a meaningful trailing space
  // at end-of-diff still collided even after the per-line strip was removed. Whitespace is content everywhere,
  // including the final line, so nothing here may trim the hashed text. `trimmed` above is used ONLY to decide
  // emptiness and to detect an already-computed digest.
  const kept = [];
  const lines = diffText.split('\n');
  const keepIndexAt = binaryIndexLines(lines); // #x9xqexm major 3 — a binary section's blob pair IS its content
  let inManifestSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A `diff --git` header opens a new file section and therefore always ends any skip in progress.
    if (line.startsWith('diff --git ')) inManifestSection = line === MANIFEST_HEADER;
    if (inManifestSection) continue;
    if (!keepIndexAt.has(i) && /^index [0-9a-f]+\.\.[0-9a-f]+/.test(line)) continue;
    kept.push(line);
  }
  // Drop trailing EMPTY lines only — `''`, never a line that carries whitespace. Skipping a manifest section
  // that sits LAST leaves the blank that preceded it dangling, and the raw text may or may not end in a newline;
  // neither is content. A line of spaces IS content (blocker 2) and is untouched by this.
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  const normalized = kept.join('\n');
  if (!normalized.trim()) return null;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** The marker carrying the #x169fqe reviewed-DIFF fingerprint, stamped beside `reviewed-sha` on an accept. */
export const REVIEWED_DIFF_MARKER = 'reviewed-diff';
const REVIEWED_DIFF_RE = new RegExp(`<!--\\s*${REVIEWED_DIFF_MARKER}:\\s*([0-9a-f]{64})\\s*-->`, 'g');

/** Build the reviewed-diff marker line from a raw diff OR a precomputed fingerprint. Pure. Unusable input → ''
 *  (nothing to stamp — the gate then falls back to SHA identity, i.e. today's behaviour). */
export function buildReviewedDiffMarker(diffOrFingerprint) {
  const fp = normalizeDiffFingerprint(diffOrFingerprint);
  return fp ? `<!-- ${REVIEWED_DIFF_MARKER}: ${fp} -->` : '';
}

/** Extract the reviewed-diff fingerprint from a PR's comments — LATEST marker wins, mirroring `parseReviewedSha`
 *  (a re-accept after a fix stamps a fresh pair). `null` when absent → the gate falls back to SHA identity.
 *  Carries the SAME forge residual documented on `parseReviewedSha`: it is an ordinary comment, not a signed
 *  artifact. It cannot make the gate LOOSER than that residual already allows — an actor who can forge a
 *  `reviewed-sha` for the live head already defeats the gate outright, without needing this. */
export function parseReviewedDiff(comments) {
  let latest = null;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    REVIEWED_DIFF_RE.lastIndex = 0;
    while ((m = REVIEWED_DIFF_RE.exec(body)) !== null) latest = m[1].toLowerCase();
  }
  return latest;
}

/**
 * #x9xqexm — THE CONTRIBUTION FINGERPRINT: a BASE-INDEPENDENT digest of what the PR itself adds and removes,
 * so a clearance survives the drain moving the head onto a newer `main` without the author touching anything.
 *
 * WHY `normalizeDiffFingerprint` IS NOT ENOUGH, measured rather than argued. On WE PR #1100 the operator ran
 * `--to=clear-human` at 14:38:35; the drain's own rebase-drop pass committed at 14:41:09 and the next daemon
 * pass revoked the clearance at 14:41:42. The two 130 KB net diffs differ in exactly three lines and NOT ONE of
 * them is this PR's content: two `index <old>..<new>` blob-pair lines (already excluded), one CONTEXT line that
 * `main` changed underneath the lane, and one HUNK OFFSET (`@@ -197,3` → `@@ -203,3`) because that file grew on
 * `main`. Every `+`/`-` line was byte-identical. `normalizeDiffFingerprint` deliberately keeps context lines and
 * `@@` offsets — a defensible reading of "the surrounding file moved, so the reviewer's reading may not hold" —
 * but the drain rebases every accepted lane onto `main` within minutes and `main` moves constantly, so in
 * practice that escape almost never fires and EVERY clearance is revoked. #x169fqe's stated intent (recognise
 * the drain's own content-preserving rebase) needs a digest that hashes the CONTRIBUTION, not the base it sits on.
 *
 * WHAT IS HASHED, and nothing else:
 *   • the per-file headers — `diff --git`, `---`/`+++`, mode / new-file / deleted-file / rename / similarity /
 *     `Binary files` lines. A file entering or leaving the diff, or changing mode, is content. A binary
 *     section's `index` blob pair is kept too (`binaryIndexLines`) — there it IS the content.
 *   • each hunk header rewritten as `@@ ~<gap> -,<oldLen> +,<newLen> @@<section heading>`. THREE parts, and the
 *     split between them is the whole design (see POSITION, below): the ABSOLUTE offsets are dropped, the
 *     LENGTHS are kept, the GAP to the previous hunk IN THE SAME FILE is kept (`*` for a file's first hunk), and
 *     git's trailing SECTION HEADING is kept verbatim.
 *   • every `+` and `-` line inside a hunk, verbatim — including whitespace-only ones. This is the contribution.
 *   • `\ No newline at end of file`, which is content.
 * DROPPED: `index` blob-pair lines of TEXT sections (restated hashes), every CONTEXT line (base text the author
 * did not write), and the hunks' absolute file offsets.
 *
 * POSITION — why the offsets are not simply thrown away (round-2 review, blocker 2). The first cut stripped the
 * whole `@@` line down to its lengths, and that collides on a RELOCATION: for any hunk more than three lines
 * from either file edge the length pair is position-invariant, so ONE ADDED GUARD LINE MOVED FROM LINE 10 TO
 * LINE 30 produced a byte-identical digest and `covers: true` (reproduced with real `git diff` output). That is
 * the "right line, wrong place" class — a guard moved below the call it guards, a `return` moved out of a
 * branch — and it is not only adversarial: a 3-way rebase that misapplies a hunk to a clean-but-wrong offset
 * produces exactly this shape with nobody attacking. Two position signals are kept, chosen because each is
 * invariant under the base moving but variant under the contribution moving:
 *   • THE SECTION HEADING (`@@ … @@ <heading>`). Git's default `xfuncname` heuristic (no `.gitattributes` in this
 *     repo) picks the NEAREST PRECEDING LINE STARTING AT COLUMN 0 WITH A LETTER — a top-level declaration, not
 *     "the enclosing function". It travels WITH the code rather than with the base, so `main` inserting lines
 *     above does not change it — but it does NOT separate a relocation between two methods of the same class,
 *     between two blocks of one long top-level function, or between any two hunks of an indented JSON/YAML file
 *     (no line there starts at column 0, so the heading is EMPTY and identical across the whole file). Those
 *     shapes collide; see THE RESIDUAL, below. If `main` RENAMES the top-level declaration the heading changes
 *     and the escape simply fails closed — the PR re-parks and the human re-clears, the safe direction.
 *   • THE INTER-HUNK GAP (this hunk's old-side start minus the previous hunk's, within the same file). A
 *     uniform whole-file displacement — the #1100 shape, `@@ -197,3` → `@@ -203,3` because the file grew above
 *     the hunk — leaves every gap unchanged. Any hunk that moves relative to its siblings changes one.
 *
 * THE RESIDUAL, stated at its true width because dropping context is a real loosening. Two diffs collide iff
 * they touch the same files in the same order, with the same hunk count, the same hunk lengths, the same
 * section headings, the same inter-hunk gaps, and byte-identical `+`/`-` lines. After the two signals above,
 * what is left is a relocation that keeps a hunk's SECTION HEADING and its GAP to the previous hunk unchanged.
 * That is wider than "one function, one hunk": it also covers a move between two methods of the same class, a
 * move between two blocks of one long top-level function, ANY relocation inside an indented JSON/YAML file
 * (the heading is empty and identical for the whole file, so no hunk in it is ever distinguished by heading),
 * and a set of hunks that relocates UNIFORMLY — a two-hunk file shifted as a block collides the same way a
 * single-hunk file does, because every gap is preserved by construction. That residual is NOT closable inside a
 * fixed-size digest, and the reason is worth writing down rather than hand-waving: the only remaining witness to
 * a within-heading move is the hunk's CONTEXT lines — and the #1100 case this whole escape exists for is one
 * where `main` changed the context line IMMEDIATELY ADJACENT to the contribution. Tolerating that and detecting
 * a within-heading move are the same measurement read in opposite directions; no digest can do both. Tracked as
 * #x413mbt (with the directions worth costing) rather than left implicit, and pinned by a deliberately-passing
 * test. What bounds it: this is checked LAST, after the SHA test and after the strict
 * `normalizeDiffFingerprint` test, so nothing that already passed behaves differently; it can only ever honour
 * an accept the strict test rejected, and only for a head advance whose every added/removed line, hunk length,
 * section heading and inter-hunk gap is unchanged.
 *
 * @param {string|null|undefined} diffText - raw unified diff, or a 64-hex fingerprint this function produced.
 *   Same idempotence caveat as `normalizeDiffFingerprint`: do not pass untrusted free-form text, and never pass
 *   a `reviewed-diff` digest here — the two digests are parsed into separate slots precisely so they cannot mix.
 * @returns {string|null} a 64-char lowercase sha256, or `null` for absent/unusable input (→ fail closed).
 */
export function normalizeContributionFingerprint(diffText) {
  if (typeof diffText !== 'string') return null;
  const trimmed = diffText.trim();
  if (!trimmed) return null;
  if (/^[0-9a-f]{64}$/.test(trimmed)) return trimmed;
  const MANIFEST_HEADER = `diff --git a/${LANE_MANIFEST} b/${LANE_MANIFEST}`;
  // `@@ -<start>[,<len>] +<start>[,<len>] @@[ <section heading>]` — git omits `,<len>` when it is exactly 1.
  const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
  const kept = [];
  const lines = diffText.split('\n');
  const keepIndexAt = binaryIndexLines(lines); // #x9xqexm major 3 — a binary section's blob pair IS its content
  let inManifestSection = false;
  let inHunk = false;
  let prevOldStart = null; // per FILE section — the anchor for the inter-hunk gap
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) {
      // A new file section always ends any skip AND any hunk in progress, and restarts the gap chain.
      inManifestSection = line === MANIFEST_HEADER;
      inHunk = false;
      prevOldStart = null;
      if (!inManifestSection) kept.push(line);
      continue;
    }
    if (inManifestSection) continue;
    const hunk = HUNK_RE.exec(line);
    if (hunk) {
      inHunk = true;
      // Absolute offsets out; lengths, the inter-hunk GAP and the SECTION HEADING in (see POSITION above).
      // An omitted length means 1 (git's own shorthand) — spell it so `@@ -1 +1 @@` and `@@ -1,1 +1,1 @@`
      // cannot hash differently for the same shape. The gap is measured on the OLD side (the base pre-image);
      // the new-side gap is derivable from it and the preceding lengths, so hashing it too would add no signal.
      const oldStart = Number(hunk[1]);
      const gap = prevOldStart === null ? '*' : String(oldStart - prevOldStart);
      prevOldStart = oldStart;
      kept.push(`@@ ~${gap} -,${hunk[2] ?? '1'} +,${hunk[4] ?? '1'} @@${hunk[5]}`);
      continue;
    }
    if (!inHunk) {
      // Pre-hunk file headers. A TEXT section's `index` line restates blob hashes already implied by the body
      // and is dropped; a BINARY section's is the only carrier of its content and is kept (`binaryIndexLines`).
      // Everything else here (`---`/`+++`, modes, renames, `Binary files …`) is content and is kept verbatim.
      if (!keepIndexAt.has(i) && /^index [0-9a-f]+\.\.[0-9a-f]+/.test(line)) continue;
      kept.push(line);
      continue;
    }
    // Inside a hunk: the contribution is the `+`/`-` lines plus the no-newline marker. A leading space (or an
    // empty line, which is how some producers spell an empty context line) is BASE text and is dropped.
    if (line.startsWith('+') || line.startsWith('-') || line.startsWith('\\')) kept.push(line);
  }
  const normalized = kept.join('\n');
  if (!normalized.trim()) return null;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * #xmnl36p — THE OPERATOR CLEARANCE RECORD, read back. `review-set-label.mjs --to=clear-human` (#2895) is the
 * ONE sanctioned way a `review:human` hold is lifted, and it already writes a durable, attributed comment. Until
 * now NOTHING read that comment back, so every automated re-score re-derived "this PR is gate-self → apply
 * `review:human`" from the diff alone and re-imposed the exact hold the operator had just lifted — with no
 * record that it was overriding a clearance, because the drain's human-park path posts no comment at all (see
 * `shouldPostParkReasonComment`) and its PR-body block is a ONE-SHOT append (`bodyHasEscalationReason`).
 * Observed on WE PR #1106: cleared 00:34:00Z, re-held 00:41:28Z, no comment.
 *
 * TWO SHAPES, both parsed, because the record predates the marker. Going forward `buildVerdictComment` stamps an
 * explicit `<!-- cleared-human: <actor> -->` marker. Every clearance written before this item carries only the
 * prose attribution line, which is produced by that same single pure function and is therefore just as much a
 * contract — matching it is what makes the fix cover the PRs already stuck in this state (#1106 among them).
 * LATEST wins, mirroring `parseReviewedSha`, so a re-clear after a bounce supersedes an older record.
 *
 * SAME FORGE RESIDUAL as its siblings, stated rather than implied: anyone who can comment on a PR can write
 * these bytes. That is not a new exposure — #2895 already ruled the unforgeable actor signal deferred (#2946),
 * and this record is used ONLY to make an automated re-hold LOUD and ATTRIBUTED, never to permit a merge. A
 * forged clearance comment cannot land anything: `decideReviewGate` still parks, and `applyLabel` is unchanged.
 */
export const CLEARED_HUMAN_MARKER = 'cleared-human';
const CLEARED_HUMAN_RE = new RegExp(`<!--\\s*${CLEARED_HUMAN_MARKER}:\\s*([^>]*?)\\s*-->`, 'g');
const CLEARED_HUMAN_PROSE_RE = /^Cleared by (.+?) via `review-set-label\.mjs --to=clear-human`/gm;

/** Build the operator-clearance marker for a `--to=clear-human` verdict comment. Pure. Empty actor → '' (no
 *  marker; the prose attribution line remains the record, exactly as it was before #xmnl36p). */
export function buildClearedHumanMarker(actor) {
  const name = String(actor || '').replace(/[\r\n>]+/g, ' ').trim();
  return name ? `<!-- ${CLEARED_HUMAN_MARKER}: ${name} -->` : '';
}

/**
 * Extract the operator clearance a PR carries, from its raw `gh pr view --json comments` array. Pure.
 *
 * AN EMPTY ACTOR IS NOT A CLEARANCE. `buildClearedHumanMarker('')` renders '' (no marker), so the producer
 * never emits one — but a hand-written or forged `<!-- cleared-human: -->` would otherwise parse to
 * `{actor:''}`, and that value is rendered in TWO places that then disagree: `decideReviewGate`'s reason says
 * "recorded by  — a re-clear is required" (a blank where a name belongs) while
 * `buildClearanceRevocationComment` falls back to "the operator". A record with no attribution is not the
 * durable, attributed record this whole item is about, so it is refused here rather than rendered twice
 * differently downstream. Review of PR #1124 (finding 3).
 * @returns {{actor:string}|null} the LATEST clearance record, or `null` when the PR was never `clear-human`-ed.
 */
export function parseOperatorClearance(comments) {
  let latest = null;
  const take = (raw) => { const actor = String(raw || '').trim(); if (actor) latest = { actor }; };
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    CLEARED_HUMAN_RE.lastIndex = 0;
    while ((m = CLEARED_HUMAN_RE.exec(body)) !== null) take(m[1]);
    CLEARED_HUMAN_PROSE_RE.lastIndex = 0;
    while ((m = CLEARED_HUMAN_PROSE_RE.exec(body)) !== null) take(m[1]);
  }
  return latest;
}

/** The marker carrying the #x9xqexm CONTRIBUTION fingerprint, stamped beside `reviewed-sha` / `reviewed-diff`. */
export const REVIEWED_CONTRIBUTION_MARKER = 'reviewed-contribution';
const REVIEWED_CONTRIBUTION_RE = new RegExp(`<!--\\s*${REVIEWED_CONTRIBUTION_MARKER}:\\s*([0-9a-f]{64})\\s*-->`, 'g');

/** Build the reviewed-contribution marker from a raw diff OR a precomputed fingerprint. Pure. Unusable input →
 *  '' (nothing to stamp — the gate then falls back to the `reviewed-diff` / SHA tests, i.e. prior behaviour). */
export function buildReviewedContributionMarker(diffOrFingerprint) {
  const fp = normalizeContributionFingerprint(diffOrFingerprint);
  return fp ? `<!-- ${REVIEWED_CONTRIBUTION_MARKER}: ${fp} -->` : '';
}

/** Extract the reviewed-contribution fingerprint from a PR's comments — LATEST marker wins, mirroring
 *  `parseReviewedSha` / `parseReviewedDiff`. `null` when absent → the gate behaves exactly as it did before
 *  #x9xqexm. Carries the same forge residual documented on `parseReviewedSha`. */
export function parseReviewedContribution(comments) {
  let latest = null;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    REVIEWED_CONTRIBUTION_RE.lastIndex = 0;
    while ((m = REVIEWED_CONTRIBUTION_RE.exec(body)) !== null) latest = m[1].toLowerCase();
  }
  return latest;
}

/**
 * #2409 — does a `review:accepted` verdict still cover the PR's LIVE head? Pure. The acceptance only vouches
 * for the tree the reviewer looked at; a commit that rode in AFTER accept is NOT covered (this is exactly the
 * PR #368 hole — a second, unrelated commit honoured under an accept that named only the first).
 *   • Either SHA unknown (no recorded reviewed SHA, or the head couldn't be read) → `{ covers: true }` — fails
 *     OPEN, so this gate NEVER mass-re-parks accepts made before it shipped, and never blocks on a fetch miss.
 *     (Mirrors the sibling manifest-baseline gate's fail-open-on-missing posture.)
 *   • SHAs match (prefix-compare, tolerant of abbreviation) → `{ covers: true }`.
 *   • Head advanced past the reviewed SHA → `{ covers: false, reason }` — a STALE acceptance; the drain
 *     refuses the auto-land and re-parks for a fresh look.
 * The gate keys on head-SHA IDENTITY, so ANY head change re-parks — including a benign rebase-onto-main /
 * force-push of an already-accepted branch that adds no review-worthy content. That is stricter than the
 * motivating "an unrelated commit rode in" case, but defensible: a rebase DOES change the tree, and the
 * re-park self-corrects on a fresh accept. We prefer the false-park over honouring an accept against a tree the
 * reviewer never saw.
 * @param {{acceptedSha?:string|null, headSha?:string|null}} o
 */
export function acceptanceCoversHead({
  acceptedSha = null, headSha = null, acceptedDiff = null, headDiff = null,
  acceptedContribution = null, headContribution = null,
} = {}) {
  const a = typeof acceptedSha === 'string' ? acceptedSha.trim().toLowerCase() : '';
  const h = typeof headSha === 'string' ? headSha.trim().toLowerCase() : '';
  if (!a || !h) return { covers: true, reason: '' };
  const n = Math.min(a.length, h.length);
  if (n >= 7 && (a.startsWith(h) || h.startsWith(a))) return { covers: true, reason: '' };
  // #x169fqe — THE CONTENT-EQUIVALENCE ESCAPE, and the ONLY one. The head moved, so the SHA test above has
  // failed; the accept survives anyway IFF the reviewed CONTENT is provably identical. Both fingerprints must be
  // present and equal — a missing or unparseable one on either side falls straight through to the stale verdict
  // below, so this is FAIL-CLOSED and every pre-#x169fqe accept behaves exactly as it did (there is no
  // fingerprint to match, so nothing is newly honoured).
  //
  // WHY THIS IS NOT A LOOSENING OF #2409. The rule #2409 wrote down is "never honour an accept against a tree the
  // reviewer never saw", and it enforced that with head-SHA identity — a PROXY, which also re-parks a benign
  // rebase-onto-main that adds no review-worthy content. Comparing the normalized reviewed DIFF enforces the rule
  // ITSELF: if the fingerprints match, the reviewer DID see this content, whatever commit now carries it. A
  // commit that rides in after accept changes the diff and is still refused — the PR #368 hole stays shut.
  const ad = normalizeDiffFingerprint(acceptedDiff);
  const hd = normalizeDiffFingerprint(headDiff);
  if (ad && hd && ad === hd) {
    return {
      covers: true,
      reason: `head moved to ${h.slice(0, 12)} but the reviewed diff is byte-identical (${ad.slice(0, 12)}) — a content-preserving rebase, the acceptance still covers this tree`,
    };
  }
  // #x9xqexm — THE CONTRIBUTION ESCAPE, checked LAST so it can only ever honour an accept the two stricter tests
  // above already rejected. `normalizeDiffFingerprint` hashes the base the contribution sits on as well as the
  // contribution, so it changes whenever `main` moves a context line or shifts a hunk offset under the lane —
  // which the drain's own rebase-drop pass causes within minutes of every accept (measured on PR #1100: three
  // differing lines across 130 KB, none of them the PR's own). This digest hashes only what the PR ADDS and
  // REMOVES, so a base-only move is recognised as covered while any change to the contribution is not. Same
  // FAIL-CLOSED shape as its sibling: both fingerprints must be present and equal, so an accept stamped before
  // #x9xqexm (no contribution marker) behaves exactly as it did.
  const ac = normalizeContributionFingerprint(acceptedContribution);
  const hc = normalizeContributionFingerprint(headContribution);
  if (ac && hc && ac === hc) {
    return {
      covers: true,
      reason: `head moved to ${h.slice(0, 12)} but the PR's own added/removed lines are unchanged (contribution ${ac.slice(0, 12)}) — the base moved underneath it, the acceptance still covers this contribution`,
    };
  }
  return {
    covers: false,
    reason: `head advanced to ${h.slice(0, 12)} past the reviewed commit ${a.slice(0, 12)} — the acceptance did not cover the current tree`,
  };
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
 * still clears a co-present `review:changes` (#2974 — the reviewer verdict wins over a stale bounce), but NOT a
 * co-present `review:human` or `review:pending` — see the body for why those pairs can now exist and must fail
 * closed (#x9xqexm). Pure.
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
  // #x9xqexm — A CO-PRESENT HOLD IS REFUSED EVEN NEXT TO `review:accepted`, and the ORDER of these tests is the
  // whole point. `review:accepted` used to short-circuit to `false` unconditionally, which was safe only because
  // the drain DELETED the accept whenever it re-parked. It no longer does (deleting a human's recorded clearance
  // was never what stopped the merge — the gate's verdict was), so a contradictory `accepted + hold` pair can now
  // survive a re-park, and this NON-SCORING path (the bare `/merge` sweep, the `--no-review-escalation`
  // override) must not read it as cleared. That path is where it matters: a bare `node scripts/merge-ai-prs.mjs`
  // sets `REVIEW_ESCALATION = false` and never calls `decideReviewGate` at all, and `classifyPr` certifies on
  // `review:accepted` alone (it does not require `ready-to-merge`, so stripping THAT protects nothing) — so this
  // predicate is the only thing standing between a stale re-park and a merge.
  //
  // WHICH PAIRS, and why the line falls where it does. The test is "could a SANCTIONED writer have produced this
  // pair?" — if not, the pair can only come from a drain re-park (refuse: that is exactly the state being
  // signalled) or an out-of-band edit (refuse: fail closed).
  //   • `accepted + human` — refused. `--to=clear-human` removes `human` as it adds `accepted`, and
  //     `--to=accepted` is refused outright on a `review:human` PR. No sanctioned writer makes this pair.
  //   • `accepted + pending` — refused too (round-2 review, blocker 1). The first cut exempted it on the reading
  //     that "an accept genuinely clears a pending park", but that does not survive this PR's own argument: the
  //     sanctioned accept REMOVES `pending` (`review-set-label.mjs` `--to=accepted` and `--to=clear-human` both
  //     carry it in `removeLabels`), so the pair is producible by no sanctioned writer either — only by the
  //     drain's stale re-park, which applies `review:pending` whenever the fresh score is not `humanRequired`.
  //     That is the PR #984 shape the backlog item itself cites, and it is the BULK of the queue, so exempting
  //     it left #2409's hole open for the common case while closing it for the rare one. `allowPending: true`
  //     still waives it — that is the #2423 relief valve, an operator naming one PR explicitly, and it is
  //     deliberately checked BEFORE the accept short-circuit so the waiver reads identically with or without a
  //     co-present accept.
  //   • `accepted + changes` — NOT refused. #2974 RULED that the reviewer verdict wins over a stale bounce and
  //     made `--to=accepted` strip `changes` for exactly that reason. Refusing it here would reverse a ratified
  //     reading and strand any PR still carrying the pre-#2974 pair, so it is left exactly as it was.
  if (hasReviewLabel(labels, REVIEW_LABELS.human)) return true;
  if (!allowPending && hasReviewLabel(labels, REVIEW_LABELS.pending)) return true;
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) return false;
  return hasReviewLabel(labels, REVIEW_LABELS.changes);
}

/**
 * #2832 — the producer-certified go-ahead label (`ready-to-merge`, #2196) named ONCE here so every write site
 * that must keep it self-consistent with the review-hold family (`pr-land`, the drain reconcile, the reviewer
 * verdict CLI) derives the string from a single source and can never drift from it.
 */
export const READY_TO_MERGE_LABEL = 'ready-to-merge';

/**
 * #2832 — the three REVIEW-HOLD labels: applying ANY of them means "this PR is held, it may NOT merge". A held
 * PR and `ready-to-merge` are contradictory (a hold AND a go-ahead at once), so wherever a hold label is
 * written or observed, `ready-to-merge` must be refused/stripped. Frozen — the canonical hold set.
 * (`review:accepted` is NOT a hold — it CLEARS one; `redteam:accepted` is an orthogonal sign-off, not a hold.)
 */
export const REVIEW_HOLD_LABELS = Object.freeze([REVIEW_LABELS.pending, REVIEW_LABELS.changes, REVIEW_LABELS.human]);

/** #2832 — is `label` one of the three review-hold labels? Pure. Used by the write sites that must strip
 *  `ready-to-merge` in the same operation they apply a hold. */
export function isReviewHoldLabel(label) {
  return REVIEW_HOLD_LABELS.includes(label);
}

/**
 * #2832 — the self-consistency invariant, as a pure predicate: does this PR carry BOTH `ready-to-merge` AND an
 * un-cleared review hold at once? That state is contradictory-by-construction and must never persist — the
 * green-CI auto-stamp refuses to create it and the drain reconcile strips it. `review:accepted` clears the hold
 * (so an accepted PR carrying `ready-to-merge` is CONSISTENT, not a conflict). Shared by the WE drain and the
 * plateau-app resident daemon so the invariant reads identically constellation-wide.
 * @param {Array} labels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @returns {boolean} true iff the label set is self-inconsistent (a hold and the go-ahead coexist)
 */
export function readyMergeConflictsWithHold(labels) {
  return hasReviewLabel(labels, READY_TO_MERGE_LABEL) && hasUnclearedReviewLabel(labels);
}

/**
 * #2832 / #984 F2 — must a drain PARK step strip `ready-to-merge`? Pure. This is the drain's whole
 * hold-vs-go-ahead decision in one place, so the strip is keyed on the PR's POST-PARK label state rather than
 * on whether this pass happens to be APPLYING a label.
 *
 * Why it is not simply `isReviewHoldLabel(applyLabel)`. That was the shipped shape, and it silently excluded
 * `review:changes`: `decideReviewGate` returns `{action:'wait-author'}` for a `review:changes` PR with NO
 * `applyLabel` (the author lane, not the drain, owns that label), so a strip nested inside an `applyLabel`
 * guard never ran for it. `review:pending`/`review:human` self-heal every pass only because their `applyLabel`
 * is re-returned every pass — an accident of gate shape, not a rule. Keying on the OBSERVED set makes all three
 * holds behave identically and gives `review:changes` the standing reconcile it had none of.
 *
 * Why it is not simply `readyMergeConflictsWithHold(observedLabels)` either. Two park shapes are not yet
 * visible in the observed set at decision time:
 *   - a FRESH park (`applyLabel` = pending/human on a PR that carries no hold YET) — the hold is being written
 *     in this same operation, so it must be folded in or the atomic park strip regresses;
 *   - a #2409 STALE-ACCEPTANCE re-park — the PR observably carries `review:accepted` alongside the hold this
 *     park is applying.
 *
 * `staleAcceptance` — WHAT IT MEANS AFTER #x9xqexm, because its original justification is now FALSE and a stale
 * justification is how the next author deletes a guard they no longer understand. It shipped reading "this same
 * park is about to REMOVE `review:accepted`, so filter it out of the effective set". #x9xqexm ends that removal:
 * a re-score never deletes a human's recorded clearance. The FLAG STAYS AND SO DOES THE FILTER, but the reason
 * is now the narrower one: on a stale re-park the accept is known-stale, so it must not be read as clearing the
 * hold being written in this same operation. The outcome is unchanged (strip), and — deliberately — it is now
 * unchanged WITH OR WITHOUT the filter: `hasUnclearedReviewLabel` refuses `accepted + human` and
 * `accepted + pending` directly (#x9xqexm), which are the only two labels a stale re-park ever applies. That
 * redundancy is the point. The round-2 review flagged exactly this hazard — a reader resolving the #x9xqexm
 * rebase could delete the "now-pointless" filter and leave `ready-to-merge` standing on an
 * `[accepted, pending]` re-park — and the fix is to make the deletion HARMLESS rather than to forbid it.
 * Both paths are pinned by test, so neither can regress silently.
 *
 * `review:accepted` on any OTHER path is never caught: a legitimately queued PR (`review:accepted` +
 * `ready-to-merge`, no hold) yields `false` here — and it never reaches a park branch at all, since
 * `decideReviewGate` returns `action:'merge'` for it. Two independent reasons it cannot be un-queued.
 * @param {Array} observedLabels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @param {{applyLabel?:(string|null), staleAcceptance?:boolean}} [o] - the park's own writes this operation:
 *   the hold label it is applying (if any), and whether it is a #2409 re-park that drops `review:accepted`.
 * @returns {boolean} true iff `ready-to-merge` must be removed
 */
export function decideParkReadyStrip(observedLabels, { applyLabel = null, staleAcceptance = false } = {}) {
  const names = (Array.isArray(observedLabels) ? observedLabels : [])
    .map((l) => (typeof l === 'string' ? l : l && l.name))
    .filter((n) => typeof n === 'string');
  const effective = staleAcceptance ? names.filter((n) => n !== REVIEW_LABELS.accepted) : names;
  if (applyLabel) effective.push(applyLabel);
  return readyMergeConflictsWithHold(effective);
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

/**
 * #xmnl36p — the durable CLEARANCE-REVOCATION notice. Pure. Rendered whenever an automated re-score re-imposes
 * `review:human` on a PR an operator had cleared, and posted UNCONDITIONALLY by the caller — it is deliberately
 * NOT routed through `shouldPostParkReasonComment` (which suppresses every human-park comment) nor through the
 * #2324 PR-body block (a one-shot append that writes nothing on the second and every later re-hold). Those two
 * together are why WE PR #1106's re-hold left no trace: the operator saw a cleared PR silently become held again.
 *
 * It names the head SHA, so `hasDrainReasonComment`'s exact-text dedup posts ONE notice per distinct head — a
 * `--watch` loop re-reaching this state on the same head stays quiet, and a genuinely new revocation is loud.
 * @param {{clearance:{actor:string}, reason:string, pr:(number|string), repo:string}} o
 */
export function buildClearanceRevocationComment({ clearance, reason, pr, repo } = {}) {
  const who = (clearance && clearance.actor) || 'the operator';
  return [
    `**Your \`review:human\` clearance was revoked by an automated re-score.** This PR was cleared by ${who} `
      + 'via the sanctioned `--to=clear-human` path; the drain has just put `review:human` back on. Nothing '
      + 'merged, and no agent can clear it — but the clearance no longer stands and a re-clear is required.',
    '',
    `**Why:** ${reason}`,
    '',
    '**To re-clear** (after checking the new head is what you cleared):',
    '',
    '```',
    `node scripts/review-set-label.mjs ${pr} --repo=${repo} --to=clear-human --actor="<you>" --reason="<your instruction>"`,
    '```',
    '',
    'If this keeps happening on a head you never pushed, the cause is the drain\'s own rebase moving the tree '
      + 'under an accepted lane, not new content — see `acceptanceCoversHead` (#2409/#x169fqe/#x9xqexm).',
  ].join('\n');
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
export function decideReviewGate({
  escalate, humanRequired = false, labels = [], acceptedSha = null, headSha = null,
  acceptedDiff = null, headDiff = null, acceptedContribution = null, headContribution = null,
  operatorClearance = null,
} = {}) {
  // A reviewer verdict (whoever applied it — for a human-gated PR only a human can) always wins, and is checked
  // FIRST so it overrides even the sticky human gate below: review:accepted IS the human clearing the gate →
  // merge; review:changes → the author lane fixes + re-pushes.
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) {
    // #2409 — the acceptance only vouches for the tree the reviewer looked at. Before honouring it, confirm the
    // PR's live head still IS that tree. If a commit rode in AFTER accept (the PR #368 hole), the acceptance is
    // STALE: refuse the auto-land and re-park for a FRESH look instead of merging an unreviewed commit under a
    // stale accept. Fails OPEN when either SHA is unknown (accept predates this gate / applied out-of-band / a
    // head-read miss) so it never mass-re-parks pre-gate accepts and never blocks on a transient fetch miss.
    // #x169fqe — the diff fingerprints are passed through so a CONTENT-PRESERVING rebase (the drain's own
    // manifest-drop pass, which fires seconds after an accept) no longer invalidates the accept. Absent
    // fingerprints reduce this to the pre-#x169fqe SHA-identity test exactly.
    const fresh = acceptanceCoversHead({
      acceptedSha, headSha, acceptedDiff, headDiff, acceptedContribution, headContribution,
    });
    if (!fresh.covers) {
      // Re-park for a fresh review: review:pending re-arms an agent panel; a gate-self/human-gated PR (fresh
      // humanRequired score, or a sticky review:human still present) re-parks review:human — only a human may
      // re-clear it. The drain drops the now-stale review:accepted alongside applying this label (see
      // merge-ai-prs.mjs). staleAcceptance flags this as the #2409 outcome for the drain's comment + label swap.
      const toHuman = humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human);
      // #xmnl36p — IS THIS RE-PARK REVOKING AN OPERATOR CLEARANCE? It is, exactly when it re-imposes
      // `review:human` on a PR whose `review:human` was lifted by the sanctioned `--to=clear-human` ceremony
      // (`operatorClearance`) — i.e. the label is being ADDED BACK, not merely kept. Note the second conjunct:
      // when the PR still carries `review:human` the hold was never lifted this cycle and re-applying it is a
      // no-op reconcile, not a revocation.
      //
      // WHAT THIS FLAG DOES AND DOES NOT DO, so nobody reads it as a loosening. It does NOT change `action`
      // (still `park` — the merge stays refused), it does NOT change `applyLabel` (still `review:human` — an
      // agent still cannot clear a gate-self edit, #2285/INVARIANT 2), and it does NOT change `humanRequired`.
      // The verdict is byte-identical to before. What it adds is an OBLIGATION on the caller: a re-hold that
      // overrides a recorded human clearance must SAY SO, durably, every time it happens. Downgrading the label
      // instead (to `review:pending`) was considered and REJECTED — `review:pending` is agent-clearable
      // (`decideSetLabel` refuses `--to=accepted` only on a `review:human` PR, and `auto-land-seam.mjs` writes
      // `review:accepted` unattended in `enforce` mode), so it would hand an agent the gate-self clearance the
      // whole tier exists to withhold. Making the re-hold impossible needs a hold label that is neither
      // operator-only nor agent-clearable, which is a new tier across ~10 consumers, not a change here.
      const revokesClearance = !!(toHuman && operatorClearance && !hasReviewLabel(labels, REVIEW_LABELS.human));
      return {
        action: 'park',
        reason: revokesClearance
          ? `review:accepted is STALE — ${fresh.reason}; re-parking for a fresh review. This REVOKES the `
            + `review:human clearance recorded by ${operatorClearance.actor} — a re-clear is required`
          : `review:accepted is STALE — ${fresh.reason}; re-parking for a fresh review`,
        applyLabel: toHuman ? REVIEW_LABELS.human : REVIEW_LABELS.pending,
        staleAcceptance: true,
        humanRequired: !!toHuman,
        revokesClearance,
        clearance: revokesClearance ? operatorClearance : null,
      };
    }
    return { action: 'merge', reason: 'review:accepted — reviewer accepted, merge' };
  }
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
  // #2820-review-fix (finding 2) — review:pending is STICKY on the LABEL too, mirroring the #2362 human-sticky
  // gate above. A PR already parked under review:pending stays parked until a verdict label arrives, EVEN IF this
  // pass's fresh score de-escalated it (a rebase dropped it below the size threshold, or a best-effort signal read
  // missed and defaulted to no-escalate). Without this branch a de-escalated pending PR falls through to the
  // `!escalate` merge return below — the DEAD ZONE that, combined with classifyPr's #2820 hold-skip, strands the
  // PR: it is `decision:'skip'` (never merged) yet the gate says `merge` (so neither the park nor the wait-author
  // branch fires in the drain), so it is skipped every pass AND absent from `parked` — no reviewer is ever
  // dispatched and review:accepted can never arrive. Parking here keeps it in `parked` (agent-reviewable) so the
  // hold has a release. The per-PR relief valve still frees it: this is the exact agent-reviewable pending park
  // (`action:'park'`, `applyLabel:review:pending`, `humanRequired:false`, no staleAcceptance) applyEscalationRelief
  // waives. Checked BEFORE `!escalate` so the sticky label wins; AFTER accepted/changes/human so a real verdict wins.
  if (hasReviewLabel(labels, REVIEW_LABELS.pending)) {
    return { action: 'park', reason: 'review:pending — awaiting an independent review', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
  }
  if (!escalate) return { action: 'merge', reason: 'no escalation signal — merge immediately' };
  // Agent-reviewable escalation, no verdict yet → park alive and wait for the verdict label. No timeout
  // (x30jq9n): landing unreviewed code on a clock is never the right failure mode; a stuck park is handled by
  // the operator, not by the drain.
  return { action: 'park', reason: 'escalated — awaiting an independent review (review:pending)', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
}
