/**
 * jury-core.mjs — the subject-agnostic JURY ENGINE core (#2653, foundational slice of epic #2649).
 *
 * WHY: this is the subject-NEUTRAL method core lifted out of `we:scripts/lib/review-core.mjs` — the pure
 * derivations that judge "a set of findings / verdicts" WITHOUT knowing what is being judged (a PR diff, a
 * plan, any future subject). `review-core.mjs` re-exports every symbol defined here so its existing callers
 * (review-core-cli, review-parked-prs, review-render, the drain) stay byte-stable: this extraction is a pure
 * MOVE + re-export, never a behaviour change. New subject-agnostic consumers import from HERE directly.
 *
 * What lives here (the four method pieces epic #2649 names):
 *   • the FINDING CONTRACT — `normalizeFinding` / `normalizeFindings` / `deriveVerdict` + the `VERDICTS` enum.
 *   • the ROUND LOOP — `NEGOTIATION_ROUND_CAP` + `deriveNegotiationOutcome` (+ `NEGOTIATION_OUTCOMES`).
 *   • the DIVERSITY-SELECTION reduction — `derivePanelVerdict` + `buildPanelFindings` +
 *     `AGGREGATION.DIVERSITY_SELECTION`, over the lens vocabulary (`MANDATE_LENSES` / `MANDATORY_LENSES` /
 *     `ADVISORY_LENSES` / `PANEL_LENSES`).
 *   • the CARE→RIGOR dial — `panelRigorForCareLevel` over the advisory `CARE_LEVELS` enum.
 *   • the JURY-LEDGER EVENT VOCABULARY (#2654, S2 of epic #2649) — `JURY_EVENT_TYPES` + `JUROR_STATUSES` and
 *     the pure `validateJuryEvent` / `normalizeJuryEvent` schema-validator. The append-only shape #2641's durable
 *     on-disk log appends and the #2642 console serializes; this slice is the SHAPE ONLY — the on-disk log and
 *     the fold that replays it into a live ledger are #2641, not here.
 *
 * What STAYS in `review-core.mjs`: everything that knows it is judging a PR DIFF — the mandate builders, the
 * plan-phase handshake, the escalation REASON→disposition policy, and the operator-facing renderers.
 *
 * The advisory CARE-LEVEL enum is single-sourced in `review-escalation.mjs` (a leaf that imports only
 * gate-config + review-policy), so `jury-core → review-escalation` is acyclic. jury-core stays label-free /
 * leash-free — a care-level is advisory review-RIGOR information (how hard to look), never a route/land policy
 * (that stays with review-escalation's `decideReviewGate`).
 *
 * Pure, unit-tested through `review-core.mjs`'s re-exports in `we:scripts/lib/__tests__/review-core.test.mjs`.
 */
import { CARE_LEVELS } from './review-escalation.mjs';

/**
 * @typedef {Object} Finding
 * @property {string} [file] - repo-relative path the finding is anchored to.
 * @property {string} summary - one-sentence statement of the defect.
 * @property {string} [failure_scenario] - concrete inputs/state → wrong output/crash.
 * @property {string} [category] - short kebab-case slug, e.g. "correctness", "simplification".
 * @property {number} [line] - 1-indexed line the finding anchors to.
 * @property {'CONFIRMED'|'PLAUSIBLE'} [verdict] - set when a verify pass ran; absent on inline-only reviews.
 * @property {'fixed'|'skipped'|'no_change_needed'} [outcome] - set only when RE-reporting after fixes were applied.
 * @property {string} [rootCause] - #2823 blameless "why the CREATOR erred" chain (the authoring failure mode), not just what is wrong.
 * @property {string} [prevention] - #2823 the cheapest durable guard that would have caught this CLASS (a deterministic gate preferred over a lens over a doc note).
 * @property {boolean} [preventionCaptured] - #2823 true when the prevention already EXISTS as a gate or is filed; false ⇒ neither built nor filed ⇒ blocks a clean accept at or above `PREVENTION_IMPACT_BAR`.
 * @property {'cosmetic'|'degraded'|'broken'|'unrecoverable'} [impactIfUnfixed] - #xdompzx what it COSTS to ship this finding (an `IMPACT_LEVELS` member; see `IMPACT_GLOSS` for each level's definition). An unrecognised or absent value adds no key and reads as UNDECLARED, which `blocksAcceptance` treats as fail-closed.
 */

/** The review verdicts (#2325). `needs-human` is the #2285 conflict-of-interest escalation: humanRequired
 *  ALWAYS wins over any finding-derived disposition (see `deriveVerdict`). `prevention-outstanding` (#2823) is
 *  the accept-gated-on-capture surface: every finding is resolved, but at least one names a PREVENTION guard
 *  that is neither already captured (an existing gate) nor filed as a future item — so a CLEAN accept is
 *  withheld ("file the guard before accept", closing the unfiled-intention gap). It is NOT a negotiable
 *  `changes` state: every finding is already fixed, so no editor round has anything to revise and no round-loop
 *  actor files the guard. `deriveNegotiationOutcome` therefore ESCALATES it straight to the operator (who files
 *  the named guard(s)), carrying the guard list in the notice — it never re-enters the round loop to burn the
 *  budget re-deriving the identical verdict. It never silently lands (`deriveNegotiationOutcome` lands ONLY
 *  `accept`). */
export const VERDICTS = Object.freeze({
  ACCEPT: 'accept',
  CHANGES: 'changes',
  NEEDS_HUMAN: 'needs-human',
  PREVENTION_OUTSTANDING: 'prevention-outstanding',
});

/**
 * Freeze a rank/gloss LOOKUP TABLE with a NULL PROTOTYPE (#xdompzx review, blocker 2). `Object.freeze` seals a
 * table's OWN properties; it does NOT detach `Object.prototype`. So on a normal object literal a bare bracket read
 * of a key that arrives as free-form model JSON — `TABLE['toString']`, `TABLE['constructor']`, `TABLE['valueOf']`,
 * `TABLE['hasOwnProperty']`, `TABLE['__proto__']` — returns an INHERITED member instead of `undefined`. A
 * `!== undefined` membership test then passes on a word that is not in the enum at all, and the inherited value
 * compares as `NaN` in every `>=` / `>` bar comparison, which is false in BOTH directions: the guard fails OPEN.
 * A null-prototype table has nothing to inherit, so an invented word is genuinely absent.
 *
 * Belt and braces on the RANK tables specifically: their membership test goes through `rankIn`, which uses
 * `Object.hasOwn`, so neither the prototype nor a future own-property addition can be mistaken for an enum member.
 * (The render tables below are read with a `??` / `||` default rather than a membership test — for those, the null
 * prototype IS the fix, because it is what makes the default fire at all.)
 *
 * EXPORTED (#xdompzx round-2, finding 5) because the same hole was present in the sibling LOOKUP tables on this
 * path: `VERDICT_LABELS` (`review-render.mjs`), and `VERDICT_MARKERS` + `STATUS_MARKERS` (`conveyor/jury-tree.mjs`)
 * are read with `??` / `||` defaults, which never fire on an inherited truthy value, so `'toString'` rendered the
 * native function into a posted PR comment and into the live conveyor tree.
 *
 * SCOPE OF THAT CLAIM, precisely (#xdompzx round-4, finding 5 — the round-2 wording said "every sibling lookup
 * table" and the round-4 panel found one it had missed in the same file): the six tables converted here are the
 * ones on the review/jury VERDICT path — `VERDICT_STRICTNESS`, `IMPACT_STRICTNESS`, `IMPACT_GLOSS`,
 * `VERDICT_LABELS`, `VERDICT_MARKERS`, `STATUS_MARKERS`. This is NOT a repo-wide guarantee: other defaulted
 * bare-bracket reads exist (e.g. `REVIEW_LENS_CHARTER` in `jury-ledger.mjs`, `LENS_DEFAULT_METHOD` and
 * `LENS_EXPECTATIONS` in `review-core.mjs`, `STATE_LABEL` in `conveyor/status-artifact.mjs`) and are untouched.
 * Sweeping them, and gating against new ones, is filed as its own `check:standards` rule (`xg9gboa`) — do not read
 * this doc as saying it already happened.
 * @param {Object<string, *>} entries
 * @returns {Object<string, *>}
 */
export const frozenLookup = (entries) => Object.freeze(Object.assign(Object.create(null), entries));

/**
 * Read a rank out of a `frozenLookup` rank table, or THROW (#xdompzx round-2, finding 6 — `verdictStrictness` and
 * `impactStrictness` were a hand-copied twin pair, edited in lockstep by the very diff that created the second).
 * Membership is `Object.hasOwn`, never a bare bracket read: these tables take keys that arrive as free-form model
 * JSON, and yielding `undefined` (or an inherited member) would lose every `>` / `>=` comparison in BOTH
 * directions — a guard that fails OPEN.
 * @param {Object<string, number>} table - a `frozenLookup` rank table.
 * @param {string} key
 * @param {string} label - the error-message lead naming the caller and what the key should be.
 * @returns {number}
 */
const rankIn = (table, key, label) => {
  const k = String(key);
  if (!Object.hasOwn(table, k)) {
    throw new Error(`${label} "${key}" — not a member of the enum this table ranks (known: ${Object.keys(table).join(', ')}).`);
  }
  return table[k];
};

/**
 * VERDICT STRICTNESS — the diversity-selection order (#2567): the STRICTEST verdict carries a lens/panel, never a
 * vote. `needs-human` (3) beats `changes` (2) beats `prevention-outstanding` (1) beats `accept` (0).
 * `prevention-outstanding` (#2823) ranks ABOVE `accept` (a co-juror's "file the guard" must never lose to another's
 * `accept`) and BELOW `changes` (an unfixed defect is a harder block than a missing guard — mirrors `deriveVerdict`,
 * which returns `changes` before it ever consults prevention).
 *
 * THE SINGLE SOURCE (#2823 round-2 finding 1): this is the ONE strictness table in the codebase. `disposition-judge`
 * (`reduceLedger`, `proposeDisposition`) and `jury-ledger` (`strictestVerdict`, the fold's per-lens roll-up) BOTH
 * IMPORT it — so "mirrors disposition-judge" is enforced BY CONSTRUCTION and can never drift again (the round-1 fix
 * missed jury-ledger's hand-copied twin; a copy cannot be missed if there is no copy). MUST stay TOTAL over
 * `VERDICTS` — the assertion below crashes at import if a new enum member has no rank, so a partial table is a
 * build-time failure, never a silent `undefined` mis-reduction at review time.
 *
 * NULL-PROTOTYPE (#xdompzx review, blocker 2) — see `frozenLookup`: a normal object literal would answer
 * `VERDICT_STRICTNESS['toString']` with an inherited function, so `'toString'` would pass a `!== undefined`
 * membership test and then compare as `NaN`, losing every `>` comparison. Membership is tested with `Object.hasOwn`.
 *
 * @verdicts-total — every `VERDICTS` member must be a key (the `check:standards` verdict-totality gate enforces the
 *   same totality the module-load assertion below does, as a static-scan backstop that also covers every other table).
 */
export const VERDICT_STRICTNESS = frozenLookup({
  [VERDICTS.ACCEPT]: 0,
  [VERDICTS.PREVENTION_OUTSTANDING]: 1,
  [VERDICTS.CHANGES]: 2,
  [VERDICTS.NEEDS_HUMAN]: 3,
});

// #2823 — ENFORCE TOTALITY over `VERDICTS` at module load. A verdict added to the enum without a rank here would
// otherwise compare as `undefined` in every strictest-wins reduction — silently ranking BELOW `accept` and dropping
// a blocking verdict (the exact defect this feature was bounced for). Fail LOUDLY at import instead.
for (const verdict of Object.values(VERDICTS)) {
  if (!Object.hasOwn(VERDICT_STRICTNESS, verdict)) {
    throw new Error(`VERDICT_STRICTNESS is not total over VERDICTS: verdict "${verdict}" has no strictness rank — add it (the table must rank every VERDICTS member).`);
  }
}

/** The strictness rank of a verdict. THROWS on an unranked verdict rather than yielding `undefined` (which every
 *  `>` comparison would silently lose). Ledger/panel verdicts are enum-constrained upstream (`validateJuryEvent`
 *  admits only `VERDICTS` values), so this never throws on real data — it is the fail-loud backstop the totality
 *  assertion above guarantees, applied at each comparison site (disposition-judge + jury-ledger both call it).
 *  Membership + the throw live once in `rankIn`, so this and `impactStrictness` cannot drift apart.
 *  @param {string} verdict
 *  @returns {number} */
export function verdictStrictness(verdict) {
  return rankIn(VERDICT_STRICTNESS, verdict, 'verdictStrictness: no strictness rank for verdict');
}

/**
 * IMPACT IF UNFIXED (#xdompzx) — what it COSTS to ship this finding, as distinct from `severity` (how bad the defect
 * looks to the lens that found it). The two come apart constantly, and before this existed only the second one was
 * expressible: a cosmetic nit and an unrecoverable data-loss race both reduced to "a finding", so the panel could
 * only COUNT objections, never RANK them by consequence. Observed on PR #1042 — a dead struct field and a stale
 * comment each arrived carrying a proposed new `check:standards` rule, and the mechanical verdict came back
 * `changes` on a diff whose only mandatory-lens objection was a race needing a branch deleted without landing
 * inside a ~30s window.
 *
 * Ordered LEAST to MOST costly. Deliberately subject-agnostic — this spine judges diffs, designs, and decisions.
 * WHAT EACH LEVEL MEANS IS NOT WRITTEN HERE: the glosses live once, as data, in `IMPACT_GLOSS` below, and the
 * mandate reviewers actually read is RENDERED from that same map. A prose copy here drifted from the prompt within
 * the commit that created it (#xdompzx review, finding 6) — so this doc deliberately points instead of restating.
 */
export const IMPACT_LEVELS = Object.freeze({
  COSMETIC: 'cosmetic',
  DEGRADED: 'degraded',
  BROKEN: 'broken',
  UNRECOVERABLE: 'unrecoverable',
});

/** WHAT EACH IMPACT LEVEL MEANS — the ONE definition, as DATA (#xdompzx review, finding 6). Both the reviewer-facing
 *  mandate (`buildSubjectMandate`) and every doc reference render from this map, so the prompt a reviewer grades
 *  against and the definition a maintainer reads cannot drift apart. Total over `IMPACT_LEVELS`, asserted at module
 *  load alongside `IMPACT_STRICTNESS`, so a level added without a gloss crashes the import rather than shipping
 *  listed-but-undefined. Null-prototype for the same reason `IMPACT_STRICTNESS` is (see `frozenLookup`).
 *  @impact-total — every `IMPACT_LEVELS` member must be a key (the `check:standards` impact-totality gate). */
export const IMPACT_GLOSS = frozenLookup({
  [IMPACT_LEVELS.COSMETIC]: 'nothing breaks; a later reader might be mildly misled',
  [IMPACT_LEVELS.DEGRADED]: 'someone hits friction or a worse result, and recovers unaided',
  [IMPACT_LEVELS.BROKEN]: 'real work is lost, duplicated, or silently skipped — recoverable, but only by someone noticing',
  [IMPACT_LEVELS.UNRECOVERABLE]: 'data or work is destroyed with no way back',
});

/** The impact ordering. Same fail-loud contract as `VERDICT_STRICTNESS`: total over `IMPACT_LEVELS`, asserted at
 *  module load, so a level added without a rank crashes the import instead of comparing as `undefined` (which every
 *  `>=` bar comparison would silently lose — reading as BELOW the bar and quietly un-blocking a real finding).
 *  NULL-PROTOTYPE, and every membership test against it is `Object.hasOwn` (#xdompzx review, blocker 2): this table
 *  is read with a key that arrives as FREE-FORM MODEL JSON, so on a normal object literal `'toString'` /
 *  `'constructor'` / `'valueOf'` / `'hasOwnProperty'` / `'__proto__'` would all validate as real impact levels and
 *  then compare as `NaN` — failing OPEN, the exact inverse of the fail-closed invariant this feature rests on.
 *  @impact-total — every `IMPACT_LEVELS` member must be a key (the `check:standards` impact-totality gate). */
export const IMPACT_STRICTNESS = frozenLookup({
  [IMPACT_LEVELS.COSMETIC]: 0,
  [IMPACT_LEVELS.DEGRADED]: 1,
  [IMPACT_LEVELS.BROKEN]: 2,
  [IMPACT_LEVELS.UNRECOVERABLE]: 3,
});

// ENFORCE TOTALITY over `IMPACT_LEVELS` at module load, for BOTH structures total over it — the rank table and the
// gloss map. A level added to the enum without a rank would compare as `undefined` at every bar; one added without a
// gloss would ship listed-in-the-prompt but undefined-to-the-reviewer. Fail LOUDLY at import instead.
for (const level of Object.values(IMPACT_LEVELS)) {
  if (!Object.hasOwn(IMPACT_STRICTNESS, level)) {
    throw new Error(`IMPACT_STRICTNESS is not total over IMPACT_LEVELS: level "${level}" has no rank — add it (the table must rank every IMPACT_LEVELS member).`);
  }
  if (!Object.hasOwn(IMPACT_GLOSS, level)) {
    throw new Error(`IMPACT_GLOSS is not total over IMPACT_LEVELS: level "${level}" has no gloss — add it (the mandate renders its definition from this map, so an ungloss'd level ships listed-but-undefined).`);
  }
}

/** Rank an impact level. THROWS on an unranked level rather than yielding `undefined` — the fail-loud backstop for
 *  every bar comparison. Shares `rankIn` with `verdictStrictness` (#xdompzx round-2, finding 6): one accessor, so
 *  the two can no longer be edited in lockstep and drift.
 *  @param {string} level
 *  @returns {number} */
export function impactStrictness(level) {
  return rankIn(IMPACT_STRICTNESS, level, 'impactStrictness: no rank for impact level');
}

/**
 * THE STRICTNESS DIAL (#xdompzx). The minimum `impactIfUnfixed` at which an uncaptured prevention guard WITHHOLDS a
 * clean accept. Findings below the bar are still reported, still ranked, and still owed a filing — they simply do
 * not block the land.
 *
 * Set to `broken` for the CURRENT context: a solo constellation whose review surface is mostly internal tooling,
 * where the cost of a blocked land (a stalled conveyor, a hand-held re-review) genuinely exceeds the cost of a
 * cosmetic defect shipping. This is the knob to TURN, not the code to rewrite, as the constellation grows —
 * lowering it to `degraded` (then `cosmetic`, the pre-#xdompzx behaviour) tightens the gate with a one-line change
 * and no consumer edits, because every consumer reads the bar from here.
 */
export const PREVENTION_IMPACT_BAR = IMPACT_LEVELS.BROKEN;

/** A finding is OUTSTANDING unless a fix pass explicitly resolved it (`outcome: 'fixed'|'no_change_needed'`). The
 *  SINGLE definition every consumer shares — `deriveVerdict` (the accept gate), `renderPreventionSummary` (the
 *  operator notice), `derivePanelVerdict` (the panel prevention scan), and `disposition-judge.reduceLedger`. Sharing
 *  it is what makes the notice and the verdict UNABLE to disagree on "is this finding still open" (#2823 round-2
 *  finding 3): they count the same set by construction, not by matching comments.
 *  @param {{outcome?: string}} finding
 *  @returns {boolean} */
export function isFindingOutstanding(finding) {
  return finding.outcome !== 'fixed' && finding.outcome !== 'no_change_needed';
}

const VALID_VERDICT_TAGS = new Set(['CONFIRMED', 'PLAUSIBLE']);
const VALID_OUTCOMES = new Set(['fixed', 'skipped', 'no_change_needed']);

/**
 * Coerce a raw finding-like object into the canonical `Finding` shape. Pure. Never throws — an unusable raw
 * value (not an object, no summary) normalizes to `null` so callers can `.filter(Boolean)` a mixed list.
 * @param {*} raw
 * @returns {Finding|null}
 */
export function normalizeFinding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = raw.summary ?? raw.finding ?? '';
  if (!String(summary).trim()) return null;
  /** @type {Finding} */
  const out = { summary: String(summary).trim() };
  if (raw.file) out.file = String(raw.file);
  if (raw.failure_scenario) out.failure_scenario = String(raw.failure_scenario);
  if (raw.category) out.category = String(raw.category);
  if (raw.line != null && Number.isFinite(Number(raw.line))) out.line = Number(raw.line);
  if (raw.verdict && VALID_VERDICT_TAGS.has(String(raw.verdict))) out.verdict = String(raw.verdict);
  if (raw.outcome && VALID_OUTCOMES.has(String(raw.outcome))) out.outcome = String(raw.outcome);
  // #2823 — the PREVENTION-INTROSPECTION fields, carried through the canonical shape so they survive into the
  // verdict/notice (not just prose). `rootCause` = a blameless "why the CREATOR erred" chain; `prevention` = the
  // cheapest durable guard that would have caught this CLASS (a `check:standards` gate preferred over a review
  // lens over a doc note); `preventionCaptured` = whether that guard already EXISTS as a gate, or is filed —
  // vs. neither (which blocks a clean accept, see `deriveVerdict`). Absent fields add NO key (old-shape findings
  // unaffected). `preventionCaptured` is coerced to a strict boolean; it is only meaningful with a `prevention`.
  if (raw.rootCause != null && String(raw.rootCause).trim()) out.rootCause = String(raw.rootCause).trim();
  if (raw.prevention != null && String(raw.prevention).trim()) out.prevention = String(raw.prevention).trim();
  if (raw.preventionCaptured != null) out.preventionCaptured = Boolean(raw.preventionCaptured);
  // #xdompzx — IMPACT IF UNFIXED, the ranking key. Validated against the enum: an unrecognised value adds NO key,
  // so a reviewer that invents its own word ("high") is treated as UNDECLARED, which `blocksAcceptance` reads as
  // fail-closed (blocking) rather than silently ranking it below the bar. Absent field adds no key, so every
  // pre-#xdompzx finding shape is carried through untouched.
  // Membership is `Object.hasOwn`, NOT a bare bracket read: this key arrives as free-form model JSON, and a bare
  // read on a normal-prototype table would accept 'toString'/'constructor'/'valueOf'/'hasOwnProperty'/'__proto__'
  // as real levels, which then compare as `NaN` and fail OPEN (#xdompzx review, blocker 2).
  if (raw.impactIfUnfixed != null && Object.hasOwn(IMPACT_STRICTNESS, String(raw.impactIfUnfixed))) {
    out.impactIfUnfixed = String(raw.impactIfUnfixed);
  }
  return out;
}

/**
 * Normalize a raw findings list. Pure. Drops anything that doesn't survive `normalizeFinding` (never throws
 * on a malformed entry — a broken record must not crash the review).
 * @param {*} rawList
 * @returns {Finding[]}
 */
export function normalizeFindings(rawList) {
  const arr = Array.isArray(rawList) ? rawList : [];
  return arr.map(normalizeFinding).filter(Boolean);
}

/**
 * Derive the overall verdict from a normalized findings list + the #2285 conflict-of-interest flag. Pure —
 * the SAME derivation every caller (a `/code-review`-shaped renderer, the drain auto-review, `/review`) uses
 * so "what does this set of findings mean" is decided once:
 *
 *   - `humanRequired` → `needs-human`, ALWAYS (checked first — a gate-self edit is never agent-cleared no
 *     matter how clean the findings look; mirrors `we:scripts/lib/review-escalation.mjs`'s `decideReviewGate`).
 *   - otherwise: any finding still OUTSTANDING (no `outcome`, or `outcome: 'skipped'`) → `changes`.
 *     A first-pass review has no `outcome` yet, so ANY finding present outstands it; a RE-report after fixes
 *     (`outcome: 'fixed'|'no_change_needed'`) resolves that finding, leaving only genuinely unaddressed ones.
 *   - all findings resolved BUT one still names an uncaptured, filable PREVENTION guard → `prevention-outstanding`
 *     (#2823, the accept-gated-on-capture negotiation): a clean accept is withheld until the guard is captured or
 *     filed. See `hasUncapturedPrevention`. This is the ONE place the acceptance gate is enforced, so every
 *     surface that reduces to `deriveVerdict` inherits it — no reviewer can accept a finding whose guard evaporated.
 *   - no outstanding findings AND no uncaptured prevention → `accept`.
 *
 * @verdicts-total — every `VERDICTS` member is a distinct return (needs-human, changes, prevention-outstanding,
 *   accept); the `check:standards` verdict-totality gate enforces it so a new member can't be dropped from the ladder.
 * @param {{findings?: Finding[]|Array<object>, humanRequired?: boolean}} [o]
 * @returns {'accept'|'changes'|'needs-human'|'prevention-outstanding'}
 */
export function deriveVerdict({ findings = [], humanRequired = false, bar = PREVENTION_IMPACT_BAR } = {}) {
  if (humanRequired) return VERDICTS.NEEDS_HUMAN;
  const list = normalizeFindings(findings);
  const outstanding = list.filter(isFindingOutstanding);
  if (outstanding.length > 0) return VERDICTS.CHANGES;
  // #2823 — accept is GATED ON PREVENTION CAPTURE. Even with every finding resolved, a finding whose named
  // prevention is neither already captured (an existing gate) nor filed as a future item withholds a clean
  // accept — the reviewer accepts only once every reasonable prevention is captured or filed.
  // #xdompzx — gated on IMPACT too, via `blocksAcceptance` (see its doc for the notice-wide / verdict-narrow split).
  if (list.some((f) => blocksAcceptance(f, { bar }))) return VERDICTS.PREVENTION_OUTSTANDING;
  return VERDICTS.ACCEPT;
}

/**
 * #2823 — does this finding carry a named PREVENTION guard that is NOT yet captured (neither an existing gate
 * nor filed as a future item)? Pure. A finding with no `prevention` names no guard, so it is never reported here —
 * an old-shape finding (pre-#2823) is unaffected.
 *
 * THE WIDE HALF of the notice-wide / verdict-narrow split (#xdompzx): where a reporting surface filters at all it
 * filters on THIS predicate (today: `renderPreventionSummary` in `we:scripts/lib/review-core.mjs`, and the drain's
 * auto-land emission test) — never on the narrower `blocksAcceptance`, which only the VERDICT reducers read.
 * `renderFindingLine` filters on neither: it prints whatever `prevention` a finding carries, which is wider still.
 * The rule to keep is the direction — no reporting surface may narrow by the BAR. The rationale for the split — and the
 * compensating control that makes it safe — is stated ONCE at `blocksAcceptance` below. Read it there.
 * @param {Finding|null|undefined} finding
 * @returns {boolean}
 */
export function hasUncapturedPrevention(finding) {
  return Boolean(finding && finding.prevention && finding.preventionCaptured !== true);
}

/**
 * #xdompzx — does this finding's uncaptured guard actually WITHHOLD the accept, at the given bar? Pure.
 *
 * THE SPLIT, STATED ONCE (this is its owning symbol; `hasUncapturedPrevention`, `renderPreventionSummary` and
 * `renderFindingLine` point back here rather than restating it):
 *   - NOTICE-WIDE — `hasUncapturedPrevention` is the pure "names a guard nobody has captured" predicate. It is the
 *     WIDEST filter any reporting surface is allowed to apply, so no uncaptured guard is filtered OUT of what a
 *     rendered review shows, whatever it would cost to ship — the bar narrows the verdict, never the report.
 *   - VERDICT-NARROW — this predicate adds "…and shipping it costs `PREVENTION_IMPACT_BAR` or more". Only the
 *     VERDICT reducers (`deriveVerdict`, `derivePanelVerdict`) read it.
 * So a reporting surface can legitimately name a guard the verdict did NOT stop for. That is the intended shape,
 * not a disagreement to "re-align" away — keeping the reporting half wide is exactly what makes the narrowed gate a
 * SCALING of the gate rather than a loss of information. Do not collapse the two back into one predicate. What is
 * still decided ONCE is each half: one definition of "owes a guard", one of "blocks".
 *
 * THE COMPENSATING CONTROL IS LOAD-BEARING, AND IT IS TWO-SIDED (review blocker 3). A relaxation that un-blocks a
 * finding is "no loss of information" only if the finding, its declared impact and its owed guard REACH a human on
 * the path the relaxation opens — the AUTO-LAND merge path, not just the escalation path. So:
 *   - INPUT: `buildSubjectMandate` demands `rootCause`/`prevention`/`preventionCaptured` on EVERY finding, at every
 *     impact, unconditionally. The bar is the CALLER's dial, never something a reviewer pre-applies by omitting a
 *     field — a demand conditioned on the bar starves this predicate of the very guards it exists to report.
 *   - OUTPUT: `renderFindingLine` (`review-render.mjs`) prints `impactIfUnfixed` and the owed `prevention` on every
 *     finding in the posted PR comment THAT CARRIES THEM — the fields are printed when present, never suppressed by
 *     the bar (an old-shape finding that declares neither simply has nothing to print), and the drain's auto-land
 *     branch (`skills-src/drain/SKILL.md`, step 3
 *     `land` → `autoLand: true`) MUST post that comment BEFORE it applies the accept labels whenever any finding
 *     satisfies `hasUncapturedPrevention(f) && !blocksAcceptance(f)` — i.e. whenever the bar is what un-blocked it.
 *     That emission is CONDITIONAL, deliberately: a clean accept with no bar-un-blocked guard posts nothing, so an
 *     ordinary land stays quiet. The guarantee is therefore narrower and exact — no land that the BAR un-blocked
 *     happens without the declared impact and the owed guard being posted first, where someone can dispute them.
 * Neither half works alone. Removing either turns this from a scaling of the gate into a silent loosening.
 *
 * FAIL-CLOSED on an undeclared impact. A finding with no valid `impactIfUnfixed` blocks exactly as it did before
 * #xdompzx, so this is a STRICT RELAXATION — it can only ever un-block a finding that explicitly declared itself
 * cheap. Every pre-#xdompzx caller and every old-shape finding is byte-stable, which is what makes the dial safe to
 * land: turning it cannot silently change the verdict on findings that never opted into the new field.
 *
 * @param {Finding|null|undefined} finding
 * @param {{bar?: string}} [o] - the dial; defaults to `PREVENTION_IMPACT_BAR`.
 * @returns {boolean}
 */
export function blocksAcceptance(finding, { bar = PREVENTION_IMPACT_BAR } = {}) {
  if (!hasUncapturedPrevention(finding)) return false;
  const declared = finding.impactIfUnfixed;
  if (declared === undefined) return true; // undeclared ⇒ fail closed, pre-#xdompzx behaviour
  return impactStrictness(declared) >= impactStrictness(bar);
}

/**
 * The negotiation round cap (#2311, v2 under epic #2285) — raised to 5 (operator call, 2026-07-13) from the
 * original spec of 3. Bounded so a non-converging editor↔reviewer cycle costs at most this many review passes
 * before it escalates to `review:human`, not an unbounded loop — but the operator's aim is fewer hand-offs to a
 * human, so the panel gets more room to converge on its own before a deadlock is declared. A tuning knob
 * (exported, not hardcoded per caller) — any caller that needs a DIFFERENT cap should say so explicitly, not
 * silently drift.
 */
export const NEGOTIATION_ROUND_CAP = 5;

/** The three negotiation-loop outcomes deriveNegotiationOutcome() can return (#2311). */
export const NEGOTIATION_OUTCOMES = Object.freeze({
  CONTINUE: 'continue',
  LAND: 'land',
  ESCALATE: 'escalate',
});

/**
 * Derive what the v2 negotiation loop (#2311) does next after a reviewer round. Pure — the ONE deterministic
 * round-cap decision every caller shares (mirrors `deriveVerdict`'s single-sourcing of the verdict itself):
 *
 *   - the round's verdict is `needs-human` → `escalate`, ALWAYS (a revision that itself touches the
 *     auto-review trust chain is the v1 conflict-of-interest case — no round budget saves it).
 *   - `prevention-outstanding` (#2823) → `escalate`, immediately. Every finding is already resolved, so another
 *     editor round has nothing to fix, and NO round-loop actor files a guard or flips `preventionCaptured` —
 *     `continue`-ing would only re-derive the identical verdict every round until the cap, then escalate anyway
 *     (burning the whole budget). So it hands STRAIGHT to the operator, who files the named guard(s); the loop
 *     cannot close this state itself. The guard list rides the escalation notice (`renderPreventionSummary`).
 *   - `accept` AND the required `test` check is green → `land` (the FULL bar holds: the final diff was
 *     accepted by a non-author reviewer AND CI is green).
 *   - `accept` but the required `test` is NOT green → NOT landable. The CI-green land clause (#2410 slice D,
 *     capstone of epic #2410) folds required-`test`-green into the land condition as a DETERMINISTIC clause of
 *     the unified bar — retiring the separate red-CI strand (`we:scripts/lane-resume.mjs`'s hand-rolled
 *     required-`test` FAIL list) so CI-green is ONE clause, not a parallel path. An `accept` over a red/pending
 *     required test is a reviewed-but-broken diff (the panel missed a defect CI caught); it re-enters the round
 *     loop like a `changes` — `continue` under the cap, `escalate` at it — and never silently lands.
 *   - `changes` and `round < roundCap` → `continue` (another editor↔reviewer round).
 *   - `changes` and `round >= roundCap` → `escalate` (non-convergence; surfaced to `review:human` same as v1's
 *     conflict-of-interest path, so the operator sees ONE escalation shape regardless of why it escalated).
 *
 * `requiredTestGreen` DEFAULTS to `true`, so every pre-#2410 caller (which passes no CI signal) is byte-stable:
 * an `accept` still lands. The clause only ever BLOCKS a land when a caller EXPLICITLY reports the required test
 * as not-green (`requiredTestGreen !== true` — so a red, pending, or unknown/`null` state all fail closed). The
 * caller owns mapping its CI state to this boolean (green ⇒ `true`; red OR pending/unknown ⇒ not green), keeping
 * this reducer subject-agnostic (it never parses a GitHub conclusion string itself).
 *
 * @verdicts-total fallthrough=changes — `changes` is the intentional final fall-through (the round-cap path); every
 *   OTHER `VERDICTS` member is handled explicitly. The `check:standards` verdict-totality gate enforces this, so a new
 *   member can never again silently ride the `changes` fall-through.
 * @param {{verdict: 'accept'|'changes'|'needs-human'|'prevention-outstanding', round: number, roundCap?: number, requiredTestGreen?: boolean}} o
 * @returns {'continue'|'land'|'escalate'}
 */
export function deriveNegotiationOutcome({ verdict, round, roundCap = NEGOTIATION_ROUND_CAP, requiredTestGreen = true }) {
  if (verdict === VERDICTS.NEEDS_HUMAN) return NEGOTIATION_OUTCOMES.ESCALATE;
  // #2823 — prevention-outstanding is NOT a negotiable `changes`: every finding is resolved, so no editor round
  // can close it and no loop actor files the guard. Escalate immediately to the operator (who files the guard),
  // rather than looping to re-derive the identical verdict until the cap. See the VERDICTS doc above.
  if (verdict === VERDICTS.PREVENTION_OUTSTANDING) return NEGOTIATION_OUTCOMES.ESCALATE;
  if (verdict === VERDICTS.ACCEPT && requiredTestGreen === true) return NEGOTIATION_OUTCOMES.LAND;
  return round < roundCap ? NEGOTIATION_OUTCOMES.CONTINUE : NEGOTIATION_OUTCOMES.ESCALATE;
}

/**
 * ============================================================================
 * THE MANDATORY POST-JURY RED-TEAM GATE (#2707).
 * ============================================================================
 *
 * A positive panel verdict is a PROPOSAL, not a ratification. Before the convergence loop LANDS an `accept`, an
 * adversarial RED-TEAM must actively try to BREAK it — and only a red-team that ran and could NOT break it
 * ratifies the accept. This closes the exact gap the feature-tracking-screen design session hit: a "foreman"
 * synthesizing a positive verdict over a jury that produced NO real signal, fabricating ratings out of nothing.
 * The rule is FAIL-CLOSED on missing signal, the same posture the rest of the engine already takes (a dead
 * mandatory lens degrades to needs-human): NO signal from the red-team is treated as a FAILING signal, never as a
 * silent accept.
 *
 * Two pure rules — the SINGLE SOURCE the subject-jury harness's red-team stage enacts (it reaches them the same
 * way the panel reduce reaches `deriveVerdict`/`deriveNegotiationOutcome`: mechanically, never re-deciding the
 * semantics per caller — #51 / F1):
 */

/**
 * Is a post-jury red-team OWED for this panel verdict? Pure. A red-team is required EXACTLY when the panel
 * verdict is `accept` — a positive verdict is the only one that could be RATIFIED, so it is the only one that
 * must first survive the adversary. A non-accept verdict is already bouncing (`changes`) or escalating
 * (`needs-human`); there is nothing to ratify, so no red-team runs (running one would only add cost, never change
 * the disposition). Mirrors `deriveNegotiationOutcome`'s "only accept lands" line — the red-team guards precisely
 * that land path.
 * @param {'accept'|'changes'|'needs-human'} verdict
 * @returns {boolean}
 */
export function redTeamRequired(verdict) {
  return verdict === VERDICTS.ACCEPT;
}

/**
 * Fold a red-team's result into the FINAL (post-red-team) verdict. Pure, FAIL-CLOSED. Delegates to `deriveVerdict`
 * with `humanRequired = !ran`, so the "no signal is a FAILING signal" invariant is the SAME one `deriveVerdict`
 * already single-sources — a red-team is not a second verdict machine:
 *   - the red-team did NOT run (`ran: false`) → `needs-human`, ALWAYS (an unrun red-team NEVER ratifies — this is
 *     the fabricated-ratings guard; `humanRequired` wins over any finding count, exactly as in `deriveVerdict`).
 *   - it ran and left OUTSTANDING findings → `changes` (the accept is broken; its findings feed the same round
 *     loop, so a red-team break is negotiated like any other `changes`, bounded by the round cap).
 *   - it ran CLEAN (no outstanding findings) → `accept` (RATIFIED — the positive verdict survived the adversary).
 * The harness only ever calls this for a verdict `redTeamRequired` returned true on; a non-accept verdict never
 * reaches the red-team.
 * @param {{ran?: boolean, findings?: Finding[]|Array<object>}} [o]
 * @returns {'accept'|'changes'|'needs-human'|'prevention-outstanding'}
 */
export function foldRedTeamVerdict({ ran = false, findings = [] } = {}) {
  return deriveVerdict({ findings, humanRequired: !ran });
}

/**
 * #2310 (v3, under epic #2285) — the MULTI-MANDATE REVIEWER PANEL. v2's single reviewer fans out into distinct
 * mandated lenses (the `/code-review` dimensions), each judging the SAME diff independently via `buildMandate`
 * (one subagent per lens, seeded with `buildPanelMandate`). The panel's combined verdict then drives the SAME
 * `deriveNegotiationOutcome` round loop v2 already established — v3 only adds the "many lens verdicts → one
 * panel verdict" reduction; the negotiate/land/escalate machinery is unchanged and single-sourced.
 *
 * Settled at spec (#2310): which lenses are MANDATORY (must unanimously accept to land) vs. ADVISORY
 * (surfaced, never blocking) is a judgment call about what already has a deterministic backstop (#51 — hookable
 * vs. judgment). `correctness` and `security` are genuine invariants with no other gate: a landed diff must not
 * be broken or exploitable, so they are MANDATORY. `standards-conformance` already has a deterministic backstop
 * (`npm run check:standards`, run as its own lane gate before every PR — #2199) — the panel's lens is a semantic
 * second opinion on top of that mechanical gate, not the only line of defense, so it is ADVISORY. `simplicity`
 * is a genuine stylistic judgment call (reasonable reviewers can disagree without the diff being unsafe to
 * land), so it is ADVISORY too. Advisory findings are ALWAYS surfaced (never silently dropped) but never block
 * the unanimous-accept land path on their own.
 */
export const MANDATE_LENSES = Object.freeze({
  CORRECTNESS: 'correctness',
  SECURITY: 'security',
  SIMPLICITY: 'simplicity',
  STANDARDS: 'standards-conformance',
});

/** Lenses that must UNANIMOUSLY accept for the panel to land the PR (#2310). A tuning knob (exported, not
 *  hardcoded per caller) — see the module doc above for why correctness/security are the mandatory pair. */
export const MANDATORY_LENSES = Object.freeze([MANDATE_LENSES.CORRECTNESS, MANDATE_LENSES.SECURITY]);

/** Lenses that are ALWAYS surfaced but never block the unanimous-accept land path (#2310) — see the module doc
 *  above for why standards-conformance/simplicity are advisory. */
export const ADVISORY_LENSES = Object.freeze([MANDATE_LENSES.SIMPLICITY, MANDATE_LENSES.STANDARDS]);

/** Every panel lens, mandatory first — the full fan-out set a v3 panel round spawns one reviewer per. */
export const PANEL_LENSES = Object.freeze([...MANDATORY_LENSES, ...ADVISORY_LENSES]);

/**
 * How the panel's per-lens/per-juror verdicts are AGGREGATED (#2567 / #2563 Fork 2). The panel is aggregated by
 * diversity-SELECTION, **never** by naive majority vote: the most critical (strictest) verdict wins — one lens or
 * juror wanting `changes`/`needs-human` carries the whole panel there. Majority voting hits the "popularity trap"
 * — LLMs share failure modes, so a vote amplifies the shared-WRONG output that most models happen to agree on
 * (`we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md`). `derivePanelVerdict` ALREADY implements this
 * (strictest-reason-wins, not a count), so this constant only NAMES the contract the care-level rigor dial scales
 * up; it does not introduce a second reducer. A single label so every consumer says "diversity-selection" the
 * same way and no caller quietly re-derives a majority vote.
 */
export const AGGREGATION = Object.freeze({ DIVERSITY_SELECTION: 'diversity-selection' });

/**
 * The panel RIGOR each advisory care-level dials (#2567, codified `#blast-radius-advisory-care-not-a-gate`). Pure,
 * total over `CARE_LEVELS`. Care-level scales HOW HARD the AI panel looks — `rounds` (editor↔reviewer negotiation
 * passes), `lenses` (which `PANEL_LENSES` fan out), and `jurorsPerLens` (independent reviewers per lens; >1 is the
 * diverse JURY that a high-care change earns) — never the ROUTE (a high-care change still gets an agent review, it
 * is not handed to a human) and never a cap on the WORK. Aggregation is ALWAYS diversity-selection, never a vote.
 *   • `none`     → no panel (the PR did not escalate; nothing to review).
 *   • `low`      → 1 round, full lens set, 1 juror per lens — the baseline panel a routine spot-check earns.
 *   • `elevated` → 2 rounds — a system-machinery / dismissed-finding change gets a second negotiation pass.
 *   • `high`     → 3 rounds + 2 jurors per lens — the maximum scrutiny (a gate-self/statute change, or several
 *                  stacked scored signals); the extra jurors are the diverse jury against shared blind spots.
 * `rounds` never exceeds `NEGOTIATION_ROUND_CAP` (the loop's own hard budget). Tuning knobs — loose to start,
 * tighten from data; kept here so a re-dial is one edit + a test.
 * @param {'none'|'low'|'elevated'|'high'} careLevel
 * @returns {{careLevel: string, rounds: number, lenses: string[], jurorsPerLens: number, aggregation: string}}
 */
export function panelRigorForCareLevel(careLevel) {
  const rigorByLevel = {
    [CARE_LEVELS.NONE]:     { rounds: 0, lenses: [],           jurorsPerLens: 0 },
    [CARE_LEVELS.LOW]:      { rounds: 1, lenses: PANEL_LENSES, jurorsPerLens: 1 },
    [CARE_LEVELS.ELEVATED]: { rounds: 2, lenses: PANEL_LENSES, jurorsPerLens: 1 },
    [CARE_LEVELS.HIGH]:     { rounds: 3, lenses: PANEL_LENSES, jurorsPerLens: 2 },
  };
  const r = rigorByLevel[careLevel];
  if (!r) {
    throw new Error(`panelRigorForCareLevel: unknown care-level "${careLevel}" — must be one of ${Object.values(CARE_LEVELS).join(', ')}`);
  }
  return {
    careLevel,
    rounds: Math.min(r.rounds, NEGOTIATION_ROUND_CAP),
    lenses: [...r.lenses],
    jurorsPerLens: r.jurorsPerLens,
    aggregation: AGGREGATION.DIVERSITY_SELECTION,
  };
}

/**
 * Tag each lens's findings with their originating lens (so a merged findings list — the editor mandate, the
 * operator-facing summary — never loses provenance) and flatten into one list. Pure.
 * @param {Object<string, Array<object>>} lensFindings - `{ [lens]: rawFindings[] }`.
 * @returns {Finding[]}
 */
export function buildPanelFindings(lensFindings = {}) {
  return Object.entries(lensFindings).flatMap(([lens, findings]) =>
    normalizeFindings(findings).map((f) => ({ ...f, category: f.category ? `${lens}/${f.category}` : lens })),
  );
}

/**
 * Reduce the panel's per-lens verdicts to ONE combined verdict the existing `deriveNegotiationOutcome` round
 * loop consumes unchanged (#2310). Pure — mirrors `deriveVerdict`'s single-sourcing:
 *
 *   - `humanRequired` (the #2285 v1 conflict-of-interest flag) → `needs-human`, ALWAYS, same as `deriveVerdict`.
 *   - `conflict` → `needs-human`. Whether the mandatory lenses' findings are a genuine MUTUALLY-EXCLUSIVE
 *     tradeoff (not just "both want changes") is a semantic read of the findings text — judgment, not a thing
 *     this pure function can detect from verdict labels alone (#51: the derivation stays mechanical, the
 *     judgment stays with the caller/subagents reading the actual findings) — so the caller passes it in
 *     explicitly, the same pattern `deriveVerdict`'s `humanRequired` already establishes.
 *   - a MANDATORY lens wants `changes` → `changes` (feeds the SAME round-cap loop v2 uses).
 *   - #2823 — the panel owes a PREVENTION guard when its FINDINGS name one that is neither captured nor filed.
 *     DESIGN CALL (round-2 finding 4, STRUCTURAL): prevention is derived from the panel's `findings`, NOT from the
 *     per-lens verdicts. A single verdict per lens cannot carry both "still has a defect" AND "owes a guard": an
 *     advisory lens holding one unresolved finding PLUS a resolved one naming an uncaptured guard reduces (via its
 *     own `deriveVerdict`) to `changes` — advisory `changes` rides the accept, so the guard leaked unfiled. Scanning
 *     the FINDINGS instead is immune to that one-verdict-per-lens flattening: a resolved finding with an uncaptured
 *     guard is seen regardless of what its lens's single verdict flattened to. Checked AFTER needs-human/changes (a
 *     real mandatory defect still outranks a missing guard — the fix comes first). The per-lens `prevention-outstanding`
 *     scan is KEPT as a belt-and-suspenders fallback for callers that pass a verdict but no findings (a mandatory
 *     lens whose whole verdict IS prevention-outstanding still surfaces). Either path → `prevention-outstanding`.
 *   - every MANDATORY lens verdict is `accept` AND nothing owes a guard → `accept` (the "unanimous accept lands"
 *     spec line — an advisory lens's ordinary outstanding findings are surfaced, never blocking).
 *
 * `findings` is REQUIRED (#2823 round-3 finding 1), not defaulted: the drain's live path built `buildPanelFindings`
 * then dropped it, so the findings-derived prevention scan saw an empty list and the advisory-prevention leak was
 * silently reinstated on the ONE path that matters. A required parameter makes an omitting caller fail LOUDLY
 * instead — pass the whole panel's list, or an explicit `[]` to assert there are none (never let it default).
 *
 * @verdicts-total — every `VERDICTS` member is handled explicitly (needs-human, changes, prevention-outstanding,
 *   accept); the `check:standards` verdict-totality gate enforces it, so a new enum member can't be dropped here.
 * @param {{lensVerdicts: Object<string, 'accept'|'changes'|'needs-human'|'prevention-outstanding'>, humanRequired?: boolean,
 *   conflict?: boolean, mandatoryLenses?: string[], findings: Array<object>}} o - `findings` (REQUIRED) is the WHOLE
 *   panel's list (`buildPanelFindings(lensFindings)`); the prevention scan reads it, immune to per-lens verdict flattening.
 * @returns {'accept'|'changes'|'needs-human'|'prevention-outstanding'}
 */
export function derivePanelVerdict({ lensVerdicts = {}, humanRequired = false, conflict = false, mandatoryLenses = MANDATORY_LENSES, findings, bar = PREVENTION_IMPACT_BAR } = {}) {
  if (findings === undefined) {
    throw new Error('derivePanelVerdict: `findings` is required — pass buildPanelFindings(lensFindings) (or an explicit [] to assert none). A defaulted [] silently reinstates the #2823 advisory-prevention leak on the drain path.');
  }
  if (humanRequired || conflict) return VERDICTS.NEEDS_HUMAN;
  if (!mandatoryLenses.length) {
    // Guard the `Array.prototype.every` vacuous-truth trap: an empty mandatory set must never silently read as
    // "everyone accepted" — a caller that misconfigures `mandatoryLenses` to `[]` gets a loud error, not a
    // free `accept` with zero verdicts actually checked.
    throw new Error('derivePanelVerdict: mandatoryLenses must be non-empty — an empty set would vacuously "accept"');
  }
  const mandatoryVerdicts = mandatoryLenses.map((lens) => lensVerdicts[lens]);
  const missing = mandatoryLenses.filter((lens) => !lensVerdicts[lens]);
  if (missing.length) {
    throw new Error(`derivePanelVerdict: missing verdict for mandatory lens(es): ${missing.join(', ')}`);
  }
  if (mandatoryVerdicts.some((v) => v === VERDICTS.NEEDS_HUMAN)) return VERDICTS.NEEDS_HUMAN;
  if (mandatoryVerdicts.some((v) => v === VERDICTS.CHANGES)) return VERDICTS.CHANGES;
  // #2823 round-2 finding 4 — derive "the panel owes a guard" from the FINDINGS, not the per-lens verdicts (the
  // structural fix). A RESOLVED finding whose named prevention is neither captured nor filed owes a guard, whatever
  // its lens's single verdict flattened to (an advisory lens with a co-resident unresolved finding would flatten to
  // `changes` and hide it). Only resolved findings count — an unresolved one is `changes` territory (fix first).
  // #xdompzx — same impact gate as `deriveVerdict`: a resolved finding whose guard is uncaptured blocks only if
  // shipping it would cost `bar` or more. Below-bar guards stay in the notice, out of the verdict.
  const preventionFromFindings = normalizeFindings(findings)
    .some((f) => !isFindingOutstanding(f) && blocksAcceptance(f, { bar }));
  // Belt-and-suspenders: a caller that passes a mandatory/advisory lens verdict of `prevention-outstanding` but no
  // findings still surfaces it (byte-stable for the pre-round-2 verdict-only callers).
  const preventionFromLens = Object.values(lensVerdicts).some((v) => v === VERDICTS.PREVENTION_OUTSTANDING);
  if (preventionFromFindings || preventionFromLens) return VERDICTS.PREVENTION_OUTSTANDING;
  if (mandatoryVerdicts.every((v) => v === VERDICTS.ACCEPT)) return VERDICTS.ACCEPT;
  return VERDICTS.CHANGES;
}

/**
 * ============================================================================
 * THE JURY-LEDGER EVENT VOCABULARY (#2654, S2 of epic #2649) — SCHEMA ONLY.
 * ============================================================================
 *
 * The jury is made observable (#2641, F4 = logbook ruling) by writing an APPEND-ONLY event log to disk; a single
 * shared fold replays that log into the live ledger the conveyor's `/workflows`-style tree and the #2642 console
 * both render. This slice defines ONLY the durable event SHAPE those two consumers serialize + a pure validator —
 * it does NOT build the on-disk log or the fold (both are #2641). Keeping the vocabulary here, next to the verdict
 * / round / panel contracts it references (a `finding` event carries a `Finding`; a `verdict` event carries a
 * `VERDICTS` value), single-sources "what a jury event is" so the writer and every reader agree by construction.
 *
 * Five event types — the F4 logbook events named in #2641's body:
 *   • `roster-picked`   — the jury roster was chosen: the jurors (id / lens / charter, optional method).
 *   • `juror-running`   — a rostered juror started its pass (its lifecycle moved pending → running).
 *   • `finding`         — a juror reported one finding (the canonical `Finding` shape).
 *   • `verdict`         — a juror reported its current verdict (a `VERDICTS` value).
 *   • `round-advanced`  — the editor↔reviewer negotiation loop advanced to a new round.
 *
 * Every event carries `type` and an integer `round` (the round it belongs to; `round-advanced` names the NEW,
 * ≥1 round). `at` (an ISO-8601 timestamp) is OPTIONAL in the schema — the durable-log writer (#2641) stamps it;
 * the validator only checks it parses when present, so the pure schema never depends on a clock. The validator is
 * NORMALIZING: it returns a clean event built from KNOWN fields only, so no caller-junk is persisted to the log.
 */

/** The five append-only jury-ledger event types (#2654). A frozen enum so every writer/reader names them once. */
export const JURY_EVENT_TYPES = Object.freeze({
  ROSTER_PICKED: 'roster-picked',
  JUROR_RUNNING: 'juror-running',
  FINDING: 'finding',
  VERDICT: 'verdict',
  ROUND_ADVANCED: 'round-advanced',
});

/** Every jury-ledger event type, in lifecycle order — the membership set `validateJuryEvent` dispatches on. */
export const JURY_EVENT_TYPE_LIST = Object.freeze(Object.values(JURY_EVENT_TYPES));

/**
 * The juror lifecycle statuses the #2641 fold DERIVES from the event stream (#2641 lists "pending / running /
 * found"). These are ledger-STATE the fold reconstructs, NOT events themselves: a juror is `pending` once
 * `roster-picked` names it, `running` after its `juror-running` event, and `found` once it has emitted a
 * `finding` or `verdict`. Named here so the fold and the console label the derived status the same way.
 */
export const JUROR_STATUSES = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  FOUND: 'found',
});

const VERDICT_VALUES = new Set(Object.values(VERDICTS));

/**
 * @typedef {Object} JurorSpec
 * @property {string} id - stable juror id, unique within the roster (the key later events reference via `jurorId`).
 * @property {string} lens - the review lens/dimension this juror judges under (e.g. a `MANDATE_LENSES` value, or a
 *   domain adapter's own lens — not constrained to the PR-diff set, since the jury is subject-agnostic).
 * @property {string} charter - the juror's charter / expectation (what it was asked to look for).
 * @property {string} [method] - optional method/model label (how this juror reviews).
 */

/**
 * @typedef {Object} JuryEvent
 * @property {'roster-picked'|'juror-running'|'finding'|'verdict'|'round-advanced'} type
 * @property {number} round - the negotiation round the event belongs to (0-based; `round-advanced` is ≥1).
 * @property {string} [at] - ISO-8601 timestamp; stamped by the #2641 log writer, absent in the pure schema.
 * @property {JurorSpec[]} [jurors] - `roster-picked` only: the chosen roster.
 * @property {string} [jurorId] - `juror-running`/`finding`/`verdict`: which rostered juror this is about.
 * @property {Finding} [finding] - `finding` only: the reported finding (canonical `Finding` shape).
 * @property {'accept'|'changes'|'needs-human'} [verdict] - `verdict` only: the juror's current verdict.
 */

/**
 * @typedef {Object} JuryEventValidation
 * @property {boolean} valid - true when `raw` is a well-formed jury event.
 * @property {string[]} errors - one message per schema violation (empty when valid).
 * @property {JuryEvent|null} event - the NORMALIZED event (known fields only) when valid, else null.
 */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function requireRound(raw, event, errors, min) {
  if (!Number.isInteger(raw.round) || raw.round < min) {
    errors.push(`${raw.type} requires an integer round >= ${min}`);
  } else {
    event.round = raw.round;
  }
}

function requireJurorId(raw, event, errors) {
  if (!isNonEmptyString(raw.jurorId)) {
    errors.push(`${raw.type} requires a non-empty jurorId`);
  } else {
    event.jurorId = raw.jurorId.trim();
  }
}

/** Normalize one roster juror spec; pushes an error (and returns null) for each malformed field. */
function normalizeJurorSpec(raw, index, errors, seen) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`jurors[${index}] must be an object`);
    return null;
  }
  const spec = {};
  let ok = true;
  if (!isNonEmptyString(raw.id)) {
    errors.push(`jurors[${index}].id must be a non-empty string`);
    ok = false;
  } else {
    spec.id = raw.id.trim();
    if (seen.has(spec.id)) {
      errors.push(`jurors[${index}].id "${spec.id}" is duplicated in the roster`);
      ok = false;
    }
    seen.add(spec.id);
  }
  if (!isNonEmptyString(raw.lens)) {
    errors.push(`jurors[${index}].lens must be a non-empty string`);
    ok = false;
  } else {
    spec.lens = raw.lens.trim();
  }
  if (!isNonEmptyString(raw.charter)) {
    errors.push(`jurors[${index}].charter must be a non-empty string`);
    ok = false;
  } else {
    spec.charter = raw.charter.trim();
  }
  if (raw.method != null) {
    if (!isNonEmptyString(raw.method)) errors.push(`jurors[${index}].method must be a non-empty string when present`);
    else spec.method = raw.method.trim();
  }
  return ok ? spec : null;
}

/**
 * Validate + normalize one append-only jury-ledger event (#2654). Pure — never throws (a malformed record must
 * not crash the log writer or the fold). Returns a structured result: `{ valid, errors, event }`. When valid,
 * `event` is a CLEAN copy carrying only the fields the schema knows (so caller-junk is never persisted); when
 * invalid, `event` is null and `errors` lists every violation. The one validator BOTH #2641's writer (reject
 * before append) and the #2642 console (reject on read) share, so a bad event is caught the same way everywhere.
 *
 * @param {*} raw
 * @returns {JuryEventValidation}
 */
export function validateJuryEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['event must be a non-null object'], event: null };
  }
  const { type } = raw;
  if (!JURY_EVENT_TYPE_LIST.includes(type)) {
    return {
      valid: false,
      // String(), not JSON.stringify(): the latter THROWS on a bigint type, breaking the never-throw contract.
      errors: [`unknown event type "${String(type)}" — must be one of ${JURY_EVENT_TYPE_LIST.join(', ')}`],
      event: null,
    };
  }

  const errors = [];
  /** @type {JuryEvent} */
  const event = { type };

  // Common envelope: `at` is optional; validate it parses as a date only when present (keeps the schema clock-free).
  if (raw.at != null) {
    if (typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) {
      errors.push('at must be a parseable date string when present');
    } else {
      event.at = raw.at;
    }
  }

  switch (type) {
    case JURY_EVENT_TYPES.ROSTER_PICKED: {
      requireRound(raw, event, errors, 0);
      if (!Array.isArray(raw.jurors) || raw.jurors.length === 0) {
        errors.push('roster-picked requires a non-empty jurors array');
      } else {
        const seen = new Set();
        event.jurors = raw.jurors.map((j, i) => normalizeJurorSpec(j, i, errors, seen)).filter(Boolean);
      }
      // #2864 — the REVIEWED head sha: which tree these jurors were actually seated over. The ledger carried no
      // commit identity at all, so a clean fold written at head A read as `clear` at head B — enforced, that
      // clears a diff no juror saw. `reviewed-sha` (#2409) cannot catch it either: that marker is stamped at
      // WRITE time, so it certifies the unreviewed tree. OPTIONAL in the schema on purpose — every event already
      // on disk predates this field, and rejecting them would erase the log rather than age it. The freshness
      // GATE is a separate decision at the consumer (the #2864 decider slice); this slice only makes the fact
      // recordable, so a ledger written from here on can be checked at all.
      if (raw.reviewedSha != null) {
        if (typeof raw.reviewedSha !== 'string' || !/^[0-9a-f]{7,64}$/.test(raw.reviewedSha)) {
          errors.push('reviewedSha must be a lowercase hex commit sha (7-64 chars) when present');
        } else {
          event.reviewedSha = raw.reviewedSha;
        }
      }
      break;
    }
    case JURY_EVENT_TYPES.JUROR_RUNNING: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      break;
    }
    case JURY_EVENT_TYPES.FINDING: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      const finding = normalizeFinding(raw.finding);
      if (!finding) errors.push('finding event requires a finding with a non-empty summary');
      else event.finding = finding;
      break;
    }
    case JURY_EVENT_TYPES.VERDICT: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      if (!VERDICT_VALUES.has(raw.verdict)) {
        errors.push(`verdict event requires a verdict of ${[...VERDICT_VALUES].join(', ')}`);
      } else {
        event.verdict = raw.verdict;
      }
      break;
    }
    case JURY_EVENT_TYPES.ROUND_ADVANCED: {
      // The NEW round the loop advanced to — ≥1 (advancing to round 0 is meaningless; round 0 is the initial roster).
      requireRound(raw, event, errors, 1);
      break;
    }
    // No default: JURY_EVENT_TYPE_LIST membership was already checked above.
  }

  return errors.length ? { valid: false, errors, event: null } : { valid: true, errors: [], event };
}

/**
 * Normalize one raw jury event to its clean `JuryEvent` shape, or `null` if it fails the schema. Pure. The
 * `.filter(Boolean)`-friendly form the #2641 fold maps a raw log over (mirrors `normalizeFinding`). Callers that
 * need the WHY of a rejection use `validateJuryEvent` for the `errors` list; this thin wrapper drops it.
 * @param {*} raw
 * @returns {JuryEvent|null}
 */
export function normalizeJuryEvent(raw) {
  return validateJuryEvent(raw).event;
}

/**
 * ============================================================================
 * THE STATELESS ROSTER-RECOMPUTE SPINE + MINIMAL LEDGER-TRAILED OVERRIDE (#2655, F3 of epic #2649).
 * ============================================================================
 *
 * The ratified F3 shape (jury-of-#2576, decision record 273a2dbd): the jury ROSTER is a STATELESS recompute from
 * `care-level + a touch-set signal` — deterministic and re-derivable, never persisted — and any deviation from
 * that recompute is a MINIMAL override layer ON TOP, trailed as an append-only ledger event (the #2654 S2 schema)
 * so the effective roster is always reconstructable as `recompute(care, touch) THEN overrides`. Keeping the base
 * a pure recompute is the whole point: nothing to migrate, nothing to drift — re-run it and you get the same
 * roster, and the persisted state is only the small override delta.
 *
 * This is the SUBJECT-AGNOSTIC spine the PR-diff resolver (`resolveJuryPlan` in review-core.mjs) and the future
 * per-domain adapters (#2656) build ON. It generalizes the PR-path-pattern touch-set (`classifyTouchSet`, which
 * reads UI file globs — a review-DIFF concern that STAYS in review-core) to an abstract `touchLenses` SIGNAL the
 * SUBJECT supplies: the spine merges the care band's static lenses with the subject's extra touch-set lenses,
 * de-duplicates (the care band wins any overlap), attaches each lens's grounding method(s) through a
 * caller-INJECTED resolver (so the UI method registry stays subject-specific), and carries provenance
 * (`attachedBy`) — knowing nothing about what is being judged. The care→RIGOR half (jurors-per-lens, rounds) is
 * reused from `panelRigorForCareLevel`, never re-derived; aggregation stays `DIVERSITY_SELECTION`.
 */

/**
 * @typedef {Object} RosterSeat
 * @property {string} lens - the review lens/perspective this seat judges under.
 * @property {string[]} methods - the grounding method id(s) for this lens (empty when no resolver was injected).
 * @property {'care'|'touch-set'|'override'} attachedBy - provenance: the care band's static set, the subject's
 *   touch-set signal, or a minimal override applied on top of the recompute.
 */

/**
 * @typedef {Object} RosterPlan
 * @property {string} careLevel - the `CARE_LEVELS` value the plan was recomputed for.
 * @property {number} jurorsPerLens - independent jurors per lens (the care band's rigor dial).
 * @property {number} rounds - editor↔reviewer negotiation rounds (the care band's rigor dial).
 * @property {string} aggregation - always `DIVERSITY_SELECTION`.
 * @property {RosterSeat[]} lenses - the resolved seats, static (care) lenses first, then touch-set lenses.
 */

/**
 * THE STATELESS ROSTER-RECOMPUTE SPINE (#2655) — `roster = f(care-level, touch-set)`. Pure, deterministic,
 * re-derivable: the same inputs always produce the same plan, so nothing about it is persisted. Subject-agnostic —
 * the SUBJECT supplies its extra lenses as the abstract `touchLenses` signal (the PR-diff subject derives that
 * signal from a file touch-set via `classifyTouchSet`; another subject derives it however it likes). The spine:
 *   • gets the care band's STATIC lens set + rigor dial from `panelRigorForCareLevel(careLevel)` — reused, never
 *     re-derived (throws on an unknown care-level, which is where that throw is single-sourced).
 *   • when the care band is `none` (no panel — nothing escalated) returns an EMPTY roster regardless of the
 *     touch-set: the touch-set only ADDS perspective lenses to an existing panel, it never conjures one.
 *   • otherwise merges the static lenses (first, in their care-band order) with the subject's `touchLenses`
 *     (after), de-duplicating so the care band wins any overlap, and attaches each lens's grounding method(s)
 *     via the injected `resolveMethods(lens)` (default: none — a subject-agnostic plan carries no methods until a
 *     caller grounds it). Each seat records `attachedBy` provenance.
 * @param {{careLevel: string, touchLenses?: string[], resolveMethods?: (lens: string) => string[]}} [o]
 * @returns {RosterPlan}
 */
export function resolveRoster({ careLevel, touchLenses = [], resolveMethods } = {}) {
  const rigor = panelRigorForCareLevel(careLevel); // throws on an unknown care-level; supplies base lenses + dial
  const methodsFor = typeof resolveMethods === 'function' ? resolveMethods : () => [];
  const attach = (lens, attachedBy) => {
    const m = methodsFor(lens);
    return { lens, methods: Array.isArray(m) ? [...m] : [], attachedBy };
  };
  const dial = { careLevel, jurorsPerLens: rigor.jurorsPerLens, rounds: rigor.rounds, aggregation: rigor.aggregation };
  if (!rigor.lenses.length) return { ...dial, lenses: [] };
  const seen = new Set();
  const entries = [];
  for (const lens of rigor.lenses) {                        // static care-band lenses first, in PANEL_LENSES order
    if (seen.has(lens)) continue;
    seen.add(lens);
    entries.push(attach(lens, 'care'));
  }
  for (const raw of (Array.isArray(touchLenses) ? touchLenses : [])) { // the subject's touch-set lenses, after
    if (!isNonEmptyString(raw)) continue;                   // reject falsy/whitespace lenses (same bar as the override path)
    const lens = raw.trim();
    if (seen.has(lens)) continue;                           // the care band wins any overlap
    seen.add(lens);
    entries.push(attach(lens, 'touch-set'));
  }
  return { ...dial, lenses: entries };
}

/** The two MINIMAL override operations on a recomputed roster (#2655, F3). Add or remove ONE lens — the smallest
 *  override surface that still lets an operator deviate from the stateless recompute. A frozen enum so every
 *  caller names them once. The overrides themselves are the ONLY persisted state (kept minimal by construction);
 *  the recompute is re-derivable, so the durable trail is `recompute(care, touch)` + this small delta. */
export const ROSTER_OVERRIDE_OPS = Object.freeze({ ADD: 'add', REMOVE: 'remove' });

/**
 * Apply a MINIMAL override list to a recomputed roster plan (#2655, F3) — the ledger-trailed override layer that
 * sits ON TOP of the stateless recompute. Pure — returns a NEW plan, never mutates its input (the recompute stays
 * canonical). Each override is `{ op: 'add'|'remove', lens }`:
 *   • `add`    — append `lens` (grounded via the injected `resolveMethods`, `attachedBy: 'override'`) if the plan
 *                does not already carry it; adding an already-present lens is a no-op (idempotent).
 *   • `remove` — drop the seat for `lens` if present; removing an absent lens is a no-op (idempotent).
 * A malformed override (not an object, empty `lens`, or an unknown `op`) throws loudly — an override is operator
 * config, and a silent mis-apply here is exactly the drift the stateless spine exists to avoid. The applied
 * effective roster is what `rosterPickedEvent` then records to the ledger, so the override is trailed there.
 * @param {RosterPlan} plan - a `resolveRoster` output.
 * @param {Array<{op: string, lens: string}>} [overrides]
 * @param {{resolveMethods?: (lens: string) => string[]}} [o]
 * @returns {RosterPlan}
 */
export function applyRosterOverrides(plan, overrides = [], { resolveMethods } = {}) {
  const methodsFor = typeof resolveMethods === 'function' ? resolveMethods : () => [];
  const entries = (Array.isArray(plan?.lenses) ? plan.lenses : []).map((e) => ({ ...e }));
  const indexOfLens = (lens) => entries.findIndex((e) => e.lens === lens);
  for (const ov of (Array.isArray(overrides) ? overrides : [])) {
    if (!ov || typeof ov !== 'object' || Array.isArray(ov)) {
      throw new Error('applyRosterOverrides: each override must be an object { op, lens }');
    }
    const { op, lens } = ov;
    if (!isNonEmptyString(lens)) {
      throw new Error(`applyRosterOverrides: override.lens must be a non-empty string (op "${String(op)}")`);
    }
    const cleanLens = lens.trim();
    if (op === ROSTER_OVERRIDE_OPS.ADD) {
      if (indexOfLens(cleanLens) === -1) {
        const m = methodsFor(cleanLens);
        entries.push({ lens: cleanLens, methods: Array.isArray(m) ? [...m] : [], attachedBy: 'override' });
      }
    } else if (op === ROSTER_OVERRIDE_OPS.REMOVE) {
      const i = indexOfLens(cleanLens);
      if (i !== -1) entries.splice(i, 1);
    } else {
      throw new Error(`applyRosterOverrides: unknown override op "${String(op)}" — must be one of ${Object.values(ROSTER_OVERRIDE_OPS).join(', ')}`);
    }
  }
  return { ...plan, lenses: entries };
}

/**
 * Materialize a roster plan into the concrete `JurorSpec[]` a `roster-picked` ledger event carries (#2655) —
 * expand each lens seat into `plan.jurorsPerLens` independent jurors (the diverse jury a high-care band earns).
 * Pure. Each juror gets a stable `id` (`lens#slot`, unique within the roster because the plan's lenses are
 * de-duplicated), the seat's `lens`, a `charter`, and — when the seat is grounded — the seat's first grounding
 * method as its `method`. The `charter` is subject-specific text, so it comes from the injected
 * `charterForLens(lens)` (an adapter supplies real charters); the default is a neutral placeholder so the spine
 * itself hardcodes no subject knowledge. A plan with `jurorsPerLens: 0` (care `none`) materializes to an empty
 * roster.
 * @param {RosterPlan} plan
 * @param {{charterForLens?: (lens: string) => string}} [o]
 * @returns {JurorSpec[]}
 */
export function materializeRoster(plan, { charterForLens } = {}) {
  const entries = Array.isArray(plan?.lenses) ? plan.lenses : [];
  const perLens = Number.isInteger(plan?.jurorsPerLens) && plan.jurorsPerLens > 0 ? plan.jurorsPerLens : 0;
  const charterOf = typeof charterForLens === 'function' ? charterForLens : (lens) => `judge the subject under the "${lens}" lens`;
  const jurors = [];
  for (const entry of entries) {
    const method = Array.isArray(entry.methods) && entry.methods.length ? entry.methods[0] : undefined;
    const charter = String(charterOf(entry.lens) || `judge the "${entry.lens}" lens`);
    for (let slot = 1; slot <= perLens; slot += 1) {
      const juror = { id: `${entry.lens}#${slot}`, lens: entry.lens, charter };
      if (method) juror.method = method;
      jurors.push(juror);
    }
  }
  return jurors;
}

/**
 * Build the `roster-picked` ledger event (the #2654 S2 schema) that RECORDS an effective roster plan (#2655) —
 * the append-only trail the F3 override layer leaves. Pure. Materializes the plan (`materializeRoster`) and wraps
 * the jurors in a schema-VALID `roster-picked` event, so what lands in the ledger is exactly the effective
 * (post-override) roster and nothing else. Returns `null` when the plan has no jurors (care `none`) — there is no
 * roster to record. The optional `at` (stamped by the #2641 log writer) and `charterForLens` pass straight
 * through. Throws only if the materialized roster somehow fails the S2 schema (a defensive self-check — the
 * materializer builds a valid roster by construction).
 * @param {RosterPlan} plan
 * @param {{round?: number, at?: string, charterForLens?: (lens: string) => string}} [o]
 * @returns {JuryEvent|null}
 */
export function rosterPickedEvent(plan, { round = 0, at, charterForLens, reviewedSha } = {}) {
  const jurors = materializeRoster(plan, { charterForLens });
  if (!jurors.length) return null; // care `none` / no seats → no roster picked, nothing to record
  const raw = { type: JURY_EVENT_TYPES.ROSTER_PICKED, round, jurors };
  if (at != null) raw.at = at;
  // #2864 — record WHICH TREE these jurors are being seated over, so a later reader can tell whether the verdict
  // it is folding still describes the PR's current head. Optional: a caller with no sha to hand (a design or
  // decision subject, where there is no commit) simply omits it and the ledger is unchanged.
  if (reviewedSha != null) raw.reviewedSha = reviewedSha;
  const { valid, errors, event } = validateJuryEvent(raw);
  if (!valid) {
    throw new Error(`rosterPickedEvent: materialized roster failed the S2 schema: ${errors.join('; ')}`);
  }
  return event;
}

/**
 * ============================================================================
 * THE SUBJECT-ADAPTER CONTRACT + THE SUBJECT-NEUTRAL MANDATE FRAMING (#2656, F2 heart of epic #2649).
 * ============================================================================
 *
 * The ratified F2 shape (jury-of-#2576, decision record 273a2dbd): the jury METHOD lives ONCE here in the
 * subject-agnostic core, and each SUBJECT (PR-diff review, design-pixel review, decision-prose review) plugs in
 * through a THIN per-domain ADAPTER. This section defines the SEAM that plug snaps into — the four interface
 * pieces every adapter supplies, plus the two core primitives that consume an adapter without knowing what is
 * being judged:
 *
 *   1. THE LENS-SET — the lenses this subject judges under. The static care-band set is subject-neutral
 *      (`PANEL_LENSES`, reused by `resolveRoster` via `panelRigorForCareLevel`); the adapter declares its extra
 *      perspective lenses (through `extractTouchSet`) and, optionally, which lenses are mandatory.
 *   2. THE GROUNDING / VALIDATION METHOD — `resolveMethods(lens, ctx)`: the tool id(s) that ground each lens in
 *      evidence (a diff-reading reviewer, an axe scan, a screenshot-diff …). The registry that maps a lens to a
 *      method stays subject-specific — the core only asks the adapter for the answer.
 *   3. THE TOUCH-SET EXTRACTOR — `extractTouchSet(input)`: the subject's raw input → the extra perspective lenses
 *      it earns. The PR-diff subject derives this from a changed-file glob; another subject derives it however it
 *      likes. The core feeds the result to `resolveRoster` as the abstract `touchLenses` signal.
 *   4. THE SUBJECT-NEUTRAL MANDATE FRAMING — `buildSubjectMandate(...)` (below): the shared "you are reviewing a
 *      <subject> against <mandate>; judge only, report concrete findings, empty list if nothing" skeleton every
 *      adapter frames its subject into. Knowing nothing about diffs, pixels, or prose, it assembles the mandate
 *      line + the neutral judge-only closing; the adapter supplies the subject noun, its isolation line, and any
 *      subject-specific body lines (for PR-diff: the #2336 no-checkout constraint).
 *
 * The reference adapter that PROVES this contract is `PR_DIFF_ADAPTER` in review-core.mjs — it re-homes the
 * existing PR-diff behaviour (the touch-set classifier, the method registry, the PR mandate framing, the
 * correctness/security mandatory lenses) behind this seam, and `resolveJuryPlan` now routes through
 * `resolveAdapterRoster` byte-for-byte. Future subjects (design-pixels, decision-prose = S5) add ONLY an adapter.
 */

/**
 * @typedef {Object} SubjectAdapter
 * @property {string} subject - stable subject id ('pr-diff' | 'design-pixels' | 'decision-prose'). REQUIRED.
 * @property {(input: *) => string[]} extractTouchSet - the subject's raw input → the extra perspective lenses it
 *   earns (the abstract `touchLenses` signal `resolveRoster` merges onto the care band). REQUIRED.
 * @property {(lens: string, ctx?: *) => string[]} resolveMethods - the grounding/validation method id(s) for a
 *   lens; the optional `ctx` carries whatever the subject needs (the PR-diff adapter reads the care band from it).
 *   REQUIRED.
 * @property {string} [subjectNoun] - the noun the mandate frames the work as ('diff', 'rendered design', …).
 * @property {string[]} [mandatoryLenses] - the lenses that must unanimously accept to land (defaults, per subject,
 *   to the core `MANDATORY_LENSES`).
 * @property {(lens: string) => string} [charterForLens] - the juror charter text for a lens (passed to
 *   `materializeRoster`); defaults to a neutral placeholder there when absent.
 * @property {(o: *) => string} [buildMandate] - the subject's mandate builder (built on `buildSubjectMandate`).
 */

/** The subject-adapter contract descriptor (#2656) — the REQUIRED and OPTIONAL interface keys, single-sourced so
 *  `validateSubjectAdapter` and adapter authors name them once. Frozen. */
export const SUBJECT_ADAPTER_CONTRACT = Object.freeze({
  required: Object.freeze(['subject', 'extractTouchSet', 'resolveMethods']),
  optional: Object.freeze(['subjectNoun', 'mandatoryLenses', 'charterForLens', 'buildMandate']),
});

/**
 * Validate that a value implements the `SubjectAdapter` contract (#2656). Pure — never throws (a malformed
 * adapter must surface as a structured result, not crash the caller). Returns `{ valid, errors }`: the three
 * REQUIRED members must be present and the right type; each OPTIONAL member, when present, must be well-typed.
 * The seam `resolveAdapterRoster` gate-checks every adapter through this before building a roster, and a
 * per-domain adapter's conformance test asserts it here — so a new subject that half-implements the contract
 * fails loudly at its own boundary, not deep inside the recompute.
 * @param {*} adapter
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateSubjectAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    return { valid: false, errors: ['adapter must be a non-null object'] };
  }
  const errors = [];
  if (!isNonEmptyString(adapter.subject)) errors.push('adapter.subject must be a non-empty string');
  if (typeof adapter.extractTouchSet !== 'function') errors.push('adapter.extractTouchSet must be a function (input) => string[]');
  if (typeof adapter.resolveMethods !== 'function') errors.push('adapter.resolveMethods must be a function (lens, ctx?) => string[]');
  if (adapter.subjectNoun != null && !isNonEmptyString(adapter.subjectNoun)) errors.push('adapter.subjectNoun, when present, must be a non-empty string');
  if (adapter.mandatoryLenses != null && !(Array.isArray(adapter.mandatoryLenses) && adapter.mandatoryLenses.length)) {
    errors.push('adapter.mandatoryLenses, when present, must be a non-empty array');
  }
  if (adapter.charterForLens != null && typeof adapter.charterForLens !== 'function') errors.push('adapter.charterForLens, when present, must be a function');
  if (adapter.buildMandate != null && typeof adapter.buildMandate !== 'function') errors.push('adapter.buildMandate, when present, must be a function');
  return { valid: errors.length === 0, errors };
}

/**
 * THE SUBJECT-NEUTRAL MANDATE SKELETON (#2656) — the shared framing every adapter builds its subject's mandate
 * on. Pure. Assembles the parts that are the SAME across subjects — the "you are reviewing a <subject> against
 * this mandate: <mandate>" opening line, and the neutral judge-only closing ("report concrete findings … nothing
 * about labels/merge policy … empty list if nothing survives") — while the adapter supplies the parts that VARY:
 * its `subjectNoun`, the `isolationLine` (what context the reviewer sees), the `findingAnchor` (what a finding is
 * anchored to — a `file` for a diff, a region for pixels), and any subject-specific `bodyLines` (the PR-diff
 * adapter's #2336 no-checkout constraint). The reference PR-diff `buildMandate` (review-core.mjs) calls this with
 * the diff-specific values, reproducing its prior text byte-for-byte — that is what "re-home the mandate framing,
 * factoring shared logic into the core rather than duplicating" means.
 * @param {{subjectNoun?: string, mandate?: string|string[], defaultMandate?: string, isolationLine?: string,
 *   findingAnchor?: string, bodyLines?: string[]}} [o]
 * @returns {string}
 */
export function buildSubjectMandate({
  subjectNoun = 'subject',
  mandate,
  defaultMandate = 'correctness',
  isolationLine = '',
  findingAnchor = 'file',
  bodyLines = [],
} = {}) {
  const mandates = (Array.isArray(mandate) ? mandate : [mandate]).filter(Boolean);
  const mandateLine = mandates.length ? mandates.join(', ') : defaultMandate;
  const body = Array.isArray(bodyLines) ? bodyLines.filter((l) => typeof l === 'string' && l.length) : [];
  return [
    `You are reviewing a ${subjectNoun} against this mandate: ${mandateLine}.`,
    ...(isNonEmptyString(isolationLine) ? [isolationLine] : []),
    ...body,
    `Judge only: report concrete findings (${findingAnchor}, one-sentence summary, the failure scenario it causes) and`,
    'nothing about labels, merge policy, or who may clear this change — that is the caller\'s decision, not yours.',
    'Report an empty findings list if nothing survives scrutiny; do not pad with stylistic nitpicks.',
    // #2823 — MANDATORY PREVENTION INTROSPECTION, single-sourced here so EVERY review surface that frames a
    // mandate through this skeleton (the diff reviewer, the panel lenses, any future subject) inherits it — it
    // cannot be skipped. Tuned per finding-class: a citation miscite earns a deterministic gate; a design-fidelity
    // miss earns a render assertion; etc.
    // #xdompzx — IMPACT FIRST. Ranking by consequence-if-shipped is what stops a review reading as a flat list of
    // objections. The level DEFINITIONS are rendered from `IMPACT_GLOSS`, never re-typed here: a pasted copy drifted
    // from the JSDoc inside the commit that introduced it (#xdompzx review, finding 6).
    `IMPACT (required, for EVERY finding): answer \`impactIfUnfixed\` — what it COSTS to ship this, using exactly`,
    `one of: ${Object.values(IMPACT_LEVELS).map((l) => `\`${l}\` = ${IMPACT_GLOSS[l]}`).join('; ')}.`,
    'Judge the CONSEQUENCE, not how bad the code looks: a defect can be ugly and cosmetic, or a two-line omission',
    'and unrecoverable. State the likelihood in your failure scenario — a rare path with a catastrophic end and a',
    'certain path with a trivial end are different findings, and the reader needs both halves to rank them. If you',
    'genuinely cannot tell, omit the field: it is then treated as blocking.',
    // #2823 — MANDATORY, UNCONDITIONAL. The demand is NOT scaled to the impact bar (#xdompzx review, blocker 3A):
    // a demand a reviewer can opt out of by declaring a finding cheap starves both the operator notice and the
    // posted PR comment of the very guards they exist to surface, on exactly the path the bar newly un-blocks.
    'PREVENTION INTROSPECTION (required, for EVERY finding you report — at every severity, nits included):',
    'alongside the finding you MUST also answer three fields — (a) ROOT CAUSE (`rootCause`): a blameless "why"',
    'chain for why the CREATOR got this wrong (the authoring failure mode), not merely what is wrong;',
    '(b) PREVENTION (`prevention`): the cheapest DURABLE guard that would have caught this whole CLASS of defect,',
    'tuned to the finding\'s class — preferring a DETERMINISTIC GATE (a `check:standards` rule / write-gate / lint)',
    'over a review lens over a doc note; and (c) CAPTURE (`preventionCaptured`): whether that guard is already',
    'CAPTURED as an existing gate (true) or must be FILED as a future backlog item (false).',
    'A script-decidable defect for which you propose no gate is an INCOMPLETE review, not a clean one.',
    // The claim below must match what the drain's auto-land branch actually emits (round-2 blocker 1B): the posted
    // review is guaranteed only when the bar is what un-blocked a guard, so the wording says exactly that.
    'WHAT THE GUARD GATES: reporting is unconditional, BLOCKING is not. A finding at',
    `\`${PREVENTION_IMPACT_BAR}\` impact or above whose prevention is neither captured nor filed BLOCKS acceptance.`,
    'A below-bar guard is still reported here and still owed a filing — it simply does not stop the land, and when',
    'the bar is what un-blocked it the reviewing agent must post your findings on the PR before it lands. Answer all',
    'three fields either way: the bar is the caller\'s dial, not yours to pre-apply by leaving a field out.',
  ].join(' ');
}

/**
 * THE ADAPTER-DRIVEN ROSTER SEAM (#2656) — resolve a jury roster for ANY subject through its adapter. Pure. This
 * is the one place a subject's adapter meets the subject-agnostic spine: it validates the adapter, asks it for the
 * touch-set signal (`extractTouchSet(input)`) and a method resolver bound to the caller's `ctx`, runs the
 * stateless `resolveRoster` recompute, and applies any minimal ledger-trailed overrides on top — all without
 * knowing what `input` is. `resolveJuryPlan` (review-core.mjs, the PR-diff resolver) delegates to this with
 * `PR_DIFF_ADAPTER`, so the shipped PR-diff path IS the reference proof that the contract holds; a future subject
 * reuses this verbatim with its own adapter.
 * @param {{adapter: SubjectAdapter, careLevel: string, input?: *, overrides?: Array<{op: string, lens: string}>,
 *   ctx?: *}} o
 * @returns {RosterPlan}
 */
export function resolveAdapterRoster({ adapter, careLevel, input, overrides = [], ctx } = {}) {
  const { valid, errors } = validateSubjectAdapter(adapter);
  if (!valid) throw new Error(`resolveAdapterRoster: invalid subject adapter: ${errors.join('; ')}`);
  const resolveMethods = (lens) => adapter.resolveMethods(lens, ctx);
  const plan = resolveRoster({ careLevel, touchLenses: adapter.extractTouchSet(input), resolveMethods });
  const ovs = Array.isArray(overrides) ? overrides : [];
  return ovs.length ? applyRosterOverrides(plan, ovs, { resolveMethods }) : plan;
}
