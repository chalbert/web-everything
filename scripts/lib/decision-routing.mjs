/**
 * decision-routing.mjs — the PURE decision-routing core (#2704, child of #2612). This codes the operator's
 * 2026-07-26 ruling into the conveyor's decision flow: a cleared decision surfaced to the conveyor should run
 * through the RIGHT multi-agent process for its stakes — RED-TEAM CONVERGENCE for a bounded call, a full DESIGN
 * COMMITTEE for a complex / critical one — auto-dispose a clearly-converged ruling SHADOW-first, and escalate to
 * a human ONLY on genuine non-convergence. Today the conveyor runs every decision as a single prepare-agent that
 * ALWAYS presents to a human (#2647); this module is the deterministic router + disposer that lets a clear ruling
 * stop needing a human in the loop.
 *
 * PURE-CORE / THIN-SHELL SPLIT (per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment], #2607).
 * The routing DECISION is script-decidable and lives HERE — given the criticality/complexity signals, which
 * process to run, and given the process's rendered ledger, whether the ruling auto-disposes (shadow-first) or
 * escalates. The actual multi-agent CONVERGENCE RUN — spawning the N adversaries / the design committee — is the
 * SHELL (`scripts/conveyor/decision-route.mjs` + the conveyor skill), which shells this core for every judgment
 * a script can make. No side effects, no I/O, deterministic — the same signals + ledger always yield the same plan.
 *
 * REUSE, DON'T REBUILD (the item's hard requirement — no second jury, judge, or auto-land engine):
 *   • criticality/complexity is the EXISTING care-level signal (`deriveCareLevel`, review-escalation.mjs, #2567) —
 *     the same care→rigor dial the jury reads and the producer escalation rubric scores. No new score is invented.
 *   • the design-committee path's multi-lens jury is the subject-agnostic jury engine (#2649) judged through the
 *     DECISION-PROSE adapter (#2657) — this module names its `mandatoryLenses`, it does not re-implement them.
 *   • the auto-dispose is the #2652 disposition judge (`disposeVerdict`) EXTENDED from PR-review to a decision
 *     card, applied SHADOW-first behind the #2675 `LAND_MODES` knob — the same shadow/enforce seam, re-homed.
 *
 * Pure, unit-tested in `we:scripts/lib/__tests__/decision-routing.test.mjs`.
 */
import { deriveCareLevel, CARE_LEVELS, CARE_LEVEL_ORDER } from './review-escalation.mjs';
import { disposeVerdict, DISPOSITIONS } from './disposition-judge.mjs';
import { LAND_MODES } from './auto-land-seam.mjs';
import { DECISION_PROSE_MANDATORY_LENSES } from './decision-prose-adapter.mjs';

/**
 * The two multi-agent processes a cleared decision can route to (#2704). A frozen enum so every caller names them
 * once. Ordered light → heavy: red-team convergence is the bounded default; the design committee is the fuller
 * process reserved for a complex / critical call.
 */
export const DECISION_PROCESSES = Object.freeze({
  // N adversaries converge to a ruling — the bounded process for a lower-criticality call. Generalizes /prepare's
  // single-agent red-team-the-default to N-converging, bounded by the #2639 review-convergence round cap.
  RED_TEAM_CONVERGENCE: 'red-team-convergence',
  // multi-proposer → multi-lens jury (#2649 via the #2657 decision-prose adapter) → synthesize — the fuller
  // process (#2676 committee shape) for a complex / critical call.
  DESIGN_COMMITTEE: 'design-committee',
});

/**
 * The two ruling dispositions the disposer emits (#2704) — the decision-card analog of #2674's land actions.
 * A frozen enum. RATIFY is proposed only on a clean convergence (and, in SHADOW mode, still logged-not-applied);
 * ESCALATE hands a genuinely non-converged / contested / fail-closed ruling to a human.
 */
export const RULING_ACTIONS = Object.freeze({
  RATIFY: 'ratify',     // the process converged to a clear ruling → auto-dispose it (shadow-first)
  ESCALATE: 'escalate', // genuine non-convergence / contested / gate-self / judge-error → hand to a human
});

/**
 * The care-level FLOOR at which a decision routes to the DESIGN COMMITTEE rather than red-team convergence (#2704).
 * A frozen tuning knob (loose to start), kept here so a re-tune is one edit + a test — never scattered. At or above
 * this care level (`elevated` = the blast-radius / large-diff / cross-repo band), a decision is "complex" enough to
 * earn the fuller committee; below it (`none` / `low`) the bounded red-team-convergence path suffices. A
 * `humanRequired` decision (a statute / policy-tier subject) is ALWAYS committee regardless of this floor — see
 * `classifyDecisionCriticality`.
 */
export const COMPLEXITY_CARE_FLOOR = CARE_LEVELS.ELEVATED;

/** care-level rank (index in the least→most order) — a total, deterministic comparison helper. Unknown → -1. */
function careRank(level) {
  const i = CARE_LEVEL_ORDER.indexOf(level);
  return i; // -1 for an unrecognized level → below `none`, so it never spuriously reaches the committee floor
}

/**
 * @typedef {Object} DecisionClassification
 * @property {'none'|'low'|'elevated'|'high'} careLevel - the reused #2567 care level (criticality/complexity signal).
 * @property {boolean} critical - a maximal-stakes decision: a `humanRequired` subject (statute / policy tier) OR
 *   the top `high` care band. A critical decision always routes to the design committee.
 * @property {boolean} complex - care at or above `COMPLEXITY_CARE_FLOOR` (blast-radius / large / cross-repo), OR
 *   critical. A complex decision routes to the design committee.
 * @property {string} trail - a one-line human-readable why for the classification.
 */

/**
 * Classify a cleared decision's criticality/complexity from the EXISTING care-level signals (#2704 acceptance:
 * "no new score invented"). PURE, total. It delegates the score to `deriveCareLevel` — the same care→rigor dial
 * the jury reads and the producer escalation rubric (`scoreEscalation`) feeds — so criticality here is exactly the
 * criticality the rest of the system already agrees on. `humanRequired` (a statute / gate-self subject) is maximum
 * criticality by construction (`deriveCareLevel` maps it to `high`), and is surfaced as `critical` so the router
 * can force the committee even if the scored signals alone were mild.
 * @param {{signals?: object, humanRequired?: boolean}} o - `signals` is the `scoreEscalation` signals object
 *   (blastRadius / size / crossRepo / dismissedFindings); `humanRequired` is the statute/policy-tier gate.
 * @returns {DecisionClassification}
 */
export function classifyDecisionCriticality({ signals = {}, humanRequired = false } = {}) {
  const careLevel = deriveCareLevel({ signals, humanRequired });
  const critical = humanRequired === true || careLevel === CARE_LEVELS.HIGH;
  const complex = critical || careRank(careLevel) >= careRank(COMPLEXITY_CARE_FLOOR);
  const trail = `care=${careLevel}${humanRequired ? ' humanRequired' : ''} → ${critical ? 'critical' : complex ? 'complex' : 'bounded'}`;
  return { careLevel, critical, complex, trail };
}

/**
 * @typedef {Object} DecisionRoutePlan
 * @property {'red-team-convergence'|'design-committee'} process - the multi-agent process to run.
 * @property {DecisionClassification} classification - the criticality/complexity classification that chose it.
 * @property {string} reason - a short machine token (`critical`, `complex`, `bounded`).
 * @property {string[]} mandatoryLenses - the lenses the design-committee jury MUST cover (the #2657 decision-prose
 *   mandatory set) — carried on both routes so the convergence run knows the bar, single-sourced from the adapter.
 * @property {string[]} trail - the human-readable routing trail.
 */

/**
 * ROUTE a cleared decision to the right multi-agent process for its stakes (#2704). PURE — the deterministic core
 * of the operator's ruling. Complex / critical → the DESIGN COMMITTEE (multi-proposer → multi-lens jury →
 * synthesize); bounded / lower-criticality → RED-TEAM CONVERGENCE (N adversaries converge). Same signals → same
 * route, always. It does NOT run the process — that is the shell; this only DECIDES which one and why.
 * @param {{signals?: object, humanRequired?: boolean, classification?: DecisionClassification}} o -
 *   pass raw `signals`/`humanRequired` (classified here), or a pre-computed `classification` to route directly.
 * @returns {DecisionRoutePlan}
 */
export function routeDecision({ signals = {}, humanRequired = false, classification } = {}) {
  // A passed-in classification is trusted ONLY when it carries the boolean axes the route reads; a malformed one
  // (missing `critical`/`complex`) is re-derived from `signals`/`humanRequired` rather than silently DOWNGRADING to
  // the lighter red-team path (both falsy would route bounded — a criticality downgrade, never the safe direction).
  const cls = classification && typeof classification === 'object'
    && typeof classification.critical === 'boolean' && typeof classification.complex === 'boolean'
    ? classification
    : classifyDecisionCriticality({ signals, humanRequired });
  const mandatoryLenses = [...DECISION_PROSE_MANDATORY_LENSES];
  if (cls.critical) {
    return {
      process: DECISION_PROCESSES.DESIGN_COMMITTEE,
      classification: cls,
      reason: 'critical',
      mandatoryLenses,
      trail: [cls.trail, 'critical decision → design committee (multi-proposer → multi-lens jury → synthesize).'],
    };
  }
  if (cls.complex) {
    return {
      process: DECISION_PROCESSES.DESIGN_COMMITTEE,
      classification: cls,
      reason: 'complex',
      mandatoryLenses,
      trail: [cls.trail, `care ≥ ${COMPLEXITY_CARE_FLOOR} → complex → design committee.`],
    };
  }
  return {
    process: DECISION_PROCESSES.RED_TEAM_CONVERGENCE,
    classification: cls,
    reason: 'bounded',
    mandatoryLenses,
    trail: [cls.trail, 'bounded decision → red-team convergence (N adversaries converge to a ruling).'],
  };
}

/**
 * @typedef {Object} RulingDispositionPlan
 * @property {'shadow'|'enforce'} mode - the NORMALIZED land mode (anything not `enforce` normalizes to `shadow`).
 * @property {'ratify'|'escalate'} action - RATIFY on a clean convergence; ESCALATE on non-convergence / contested.
 * @property {boolean} apply - whether the ruling is actually RATIFIED (true ONLY on a clean converge in `enforce`).
 *   In `shadow` (the default) a clean convergence yields `apply:false` — the would-ratify is LOGGED, a human still
 *   confirms — mirroring the #2675 auto-land seam.
 * @property {string} reason - the disposition judge's machine reason token (or a seam-level token).
 * @property {string} observation - a human/ledger line: what happened, or what it WOULD do in shadow.
 * @property {string[]} trail - the full disposition trail (the judge's trail plus the seam outcome).
 */

/**
 * THE PURE DISPOSITION DECIDER (#2704) — given the #2652 combined judge's VERDICT over the process's jury ledger
 * and the resolved land MODE, decide whether the converged ruling is RATIFIED (auto-disposed) or ESCALATED, and —
 * in `enforce` only — whether to actually apply it. PURE: the same verdict + mode always yield the same plan. This
 * is the decision-card analog of `decideAutoLand` (#2675); it reuses that seam's SHADOW-first semantics and its
 * `LAND_MODES` enum rather than a second auto-dispose engine. The judge itself is `disposeVerdict` (#2652) — never
 * re-implemented here.
 *
 * @param {{ verdict: import('./disposition-judge.mjs').DispositionVerdict, mode?: string }} o -
 *   `verdict` is a `disposeVerdict` result; `mode` is the resolved `landMode` (`shadow` | `enforce`; else → shadow).
 * @returns {RulingDispositionPlan}
 */
export function decideDecisionDisposition({ verdict, mode } = {}) {
  // Fail-closed mode normalization (mirrors decideAutoLand): only the exact `enforce` string enables acting;
  // undefined / null / a typo / a future mode all normalize to SHADOW, the safe observe-only default.
  const effectiveMode = mode === LAND_MODES.ENFORCE ? LAND_MODES.ENFORCE : LAND_MODES.SHADOW;

  // A malformed / absent verdict is fail-closed to ESCALATE — never guess a ratify from a bad input.
  if (!verdict || typeof verdict !== 'object' || typeof verdict.disposition !== 'string') {
    return {
      mode: effectiveMode,
      action: RULING_ACTIONS.ESCALATE,
      apply: false,
      reason: 'bad-verdict',
      observation: 'decision-dispose: no usable judge verdict — escalate to a human (fail-closed).',
      trail: ['No usable disposition verdict — fail-closed escalate.'],
    };
  }

  const reason = typeof verdict.reason === 'string' ? verdict.reason : '';
  const judgeTrail = Array.isArray(verdict.trail) ? [...verdict.trail] : [];

  // ESCALATE — the judge did not clear the ruling (genuine non-convergence, contested, red-refuted, gate-self,
  // or any fail-closed reason). Hand it to a human. This is the ONLY path to the human: a clean convergence never
  // escalates (the whole efficiency point of the ruling).
  if (verdict.disposition !== DISPOSITIONS.AUTO_DISPOSE) {
    return {
      mode: effectiveMode,
      action: RULING_ACTIONS.ESCALATE,
      apply: false,
      reason: reason || 'escalate',
      observation: `decision-dispose: escalate to a human — the process did not converge to a clear ruling${reason ? ` (${reason})` : ''}.`,
      trail: [...judgeTrail, 'Judge escalated — hand the decision to a human.'],
    };
  }

  // AUTO-DISPOSE survived green + the red adversary → the ruling converged. Apply the SHADOW-first seam.
  if (effectiveMode === LAND_MODES.SHADOW) {
    return {
      mode: LAND_MODES.SHADOW,
      action: RULING_ACTIONS.RATIFY,
      apply: false, // OBSERVE-only: log the would-ratify; a human still confirms during the confidence-building period.
      reason: reason || 'unanimous-accept',
      observation: `decision-dispose [SHADOW]: WOULD ratify the converged ruling${reason ? ` (${reason})` : ''} — nothing applied; a human still confirms.`,
      trail: [...judgeTrail, 'SHADOW mode — logged the would-ratify; the shadow→enforce flip is a separate later ruling.'],
    };
  }
  return {
    mode: LAND_MODES.ENFORCE,
    action: RULING_ACTIONS.RATIFY,
    apply: true, // ENFORCE: a clean auto-dispose ratifies the ruling with no human in the loop.
    reason: reason || 'unanimous-accept',
    observation: `decision-dispose [ENFORCE]: ratifying the converged ruling${reason ? ` (${reason})` : ''} — no human in the loop.`,
    trail: [...judgeTrail, 'ENFORCE mode — the converged ruling is auto-disposed (ratified).'],
  };
}

/**
 * DISPOSE a decision ruling end-to-end (#2704) — run the #2652 combined judge over the process's jury LEDGER, then
 * apply the SHADOW-first disposition seam. PURE, fail-closed: a bad/missing config makes `disposeVerdict` throw, so
 * this catches it and ESCALATES (an error NEVER becomes an auto-ratify), mirroring the #2674 seam's extra ring.
 * ONE call turns a converged (or contested) decision ledger into a ratify-or-escalate PLAN; it applies NOTHING —
 * the actual ratify (in `enforce`) stays the caller's / a later-ruling's seam, exactly as #2675 keeps the label
 * write out of the pure decider.
 *
 * @param {{ ledger?: Array<object>, config: object, signals?: object, mandatoryLenses?: string[], mode?: string }} o -
 *   `ledger` is the process's #2654 jury-ledger event stream; `config` is a RESOLVED #2651 disposition config;
 *   `signals` are the judge's hard-escalate signals (`gateSelf` / `humanRequired` / `nonConvergence`);
 *   `mandatoryLenses` defaults to the #2657 DECISION-PROSE mandatory set (root-cause + completeness) — the lenses a
 *   decision jury actually covers, NOT the judge's PR-review default (correctness + security);
 *   `mode` is the resolved `landMode` (defaults to SHADOW when omitted — the ratified default).
 * @returns {RulingDispositionPlan & { verdict: (import('./disposition-judge.mjs').DispositionVerdict|null) }}
 */
export function disposeDecisionRuling({ ledger = [], config, signals = {}, mandatoryLenses, mode } = {}) {
  const lenses = Array.isArray(mandatoryLenses) && mandatoryLenses.length
    ? mandatoryLenses
    : [...DECISION_PROSE_MANDATORY_LENSES];
  let verdict;
  try {
    verdict = disposeVerdict({ ledger, config, signals, mandatoryLenses: lenses });
  } catch (e) {
    const msg = (e && e.message) || 'disposeVerdict threw';
    return {
      mode: mode === LAND_MODES.ENFORCE ? LAND_MODES.ENFORCE : LAND_MODES.SHADOW,
      action: RULING_ACTIONS.ESCALATE,
      apply: false,
      reason: 'judge-error',
      observation: `decision-dispose: the judge could not run (${msg}) — escalate to a human (fail-closed).`,
      trail: [`judge-error: ${msg} — fail-closed escalate.`],
      verdict: null,
    };
  }
  const plan = decideDecisionDisposition({ verdict, mode });
  return { ...plan, verdict };
}

// ====================================================================================================================
// THE SHADOW→ENFORCE FLIP (#2754, child of #2753). #2704 above runs the disposer SHADOW-first: a converged ruling
// yields `apply:false` (the would-ratify is LOGGED, a human still confirms). #2704 deliberately left the flip to
// `enforce` as "a separate later ruling." THIS is that ruling — the decision-flow analog of the #2675 PR-review
// shadow→enforce seam, and it deliberately mirrors that shape rather than inventing a new one. It does NOT build a
// second disposer or auto-ratify engine; it DEFINES *when* the existing `decideDecisionDisposition` above is allowed
// to flip `apply:false → apply:true`, gated on a concrete, tracked confidence metric read off a shadow-vs-human
// agreement ledger. The flip is mechanical once the gate is green; a single divergence resets it and stays in shadow.
// ====================================================================================================================

/**
 * The per-decision shadow-vs-human outcome (#2754). A frozen enum. Each DECIDED decision, once a human has ruled,
 * gets one record: did the shadow disposer's would-ratify action MATCH the human's actual ruling, or DIVERGE?
 */
export const SHADOW_OUTCOMES = Object.freeze({
  MATCH: 'match',           // the shadow would-ratify action equals the human's ruling action (agreement)
  DIVERGENCE: 'divergence', // the shadow action ≠ the human ruling (or the record is malformed) — resets the streak
});

/**
 * THE UN-DEFER TRIGGER (#2754) — the concrete, tracked gate the flip is defined behind, NOT an open-ended "later."
 * A frozen tuning knob kept here so a re-tune is one edit + a test. The enforce-flip fires once `N` consecutive
 * shadow auto-ratifications match the human ruling with ZERO divergence over the trailing window of `M` decided
 * decisions. A single divergence (shadow would-ratify ≠ human ruling) resets the streak and blocks the flip until it
 * rebuilds — the confidence bar is AGREEMENT, not volume alone. Starting proposal per the item: N = 20, M = 20.
 */
export const ENFORCE_FLIP_TRIGGER = Object.freeze({
  N: 20, // consecutive most-recent matches (0 divergences) required to arm the flip
  M: 20, // trailing window of decided decisions the "zero divergences" bar is measured over
});

/**
 * @typedef {Object} ShadowOutcomeRecord
 * @property {'ratify'|'escalate'|null} shadowAction - the shadow disposer's action (null if the input was malformed).
 * @property {'ratify'|'escalate'|null} humanAction - the human's actual ruling action (null if malformed).
 * @property {'match'|'divergence'} outcome - MATCH iff both actions are valid and equal; else DIVERGENCE (fail-closed).
 * @property {boolean} match - convenience boolean mirror of `outcome === 'match'`.
 */

/** A valid ruling action is exactly one of the two `RULING_ACTIONS`. Pure. */
function isRulingAction(a) {
  return a === RULING_ACTIONS.RATIFY || a === RULING_ACTIONS.ESCALATE;
}

/**
 * RECORD one decided decision's shadow-vs-human outcome (#2754) — the metric's ground-truth event. PURE, fail-closed.
 * `match` is CLASS AGREEMENT on the disposition action: the shadow disposer's would-ratify action equals the human's
 * actual ruling action. The strictest safe predicate for a sensitive auto-ratify flip — it counts BOTH "shadow would
 * ratify but the human escalated" AND "shadow escalated but the human ratified" as divergences (either disagreement
 * erodes confidence in letting the shadow run unattended). A malformed / partial input can NEVER inflate the streak:
 * an unrecognized action on either side yields a DIVERGENCE, never a match.
 * @param {{ shadowAction?: string, humanAction?: string }} o - the shadow disposer's action and the human's ruling
 *   action, each a `RULING_ACTIONS` value. (Convenience: `shadowPlan`/`humanPlan` objects are also accepted and their
 *   `.action` read, so a caller can pass the `decideDecisionDisposition` plan directly.)
 * @returns {ShadowOutcomeRecord}
 */
export function recordShadowOutcome({ shadowAction, humanAction, shadowPlan, humanPlan } = {}) {
  const sa = isRulingAction(shadowAction) ? shadowAction
    : (shadowPlan && typeof shadowPlan === 'object' && isRulingAction(shadowPlan.action) ? shadowPlan.action : null);
  const ha = isRulingAction(humanAction) ? humanAction
    : (humanPlan && typeof humanPlan === 'object' && isRulingAction(humanPlan.action) ? humanPlan.action : null);
  const match = sa !== null && ha !== null && sa === ha;
  return Object.freeze({
    shadowAction: sa,
    humanAction: ha,
    outcome: match ? SHADOW_OUTCOMES.MATCH : SHADOW_OUTCOMES.DIVERGENCE,
    match,
  });
}

/** Does a ledger record count as a MATCH? Fail-closed: anything not unambiguously a match is a divergence. Pure. */
function recordIsMatch(r) {
  if (!r || typeof r !== 'object') return false;
  if (r.outcome === SHADOW_OUTCOMES.DIVERGENCE) return false; // an explicit divergence never counts, even if contradictory
  return r.match === true || r.outcome === SHADOW_OUTCOMES.MATCH;
}

/**
 * @typedef {Object} AgreementMetric
 * @property {number} consecutiveMatches - matches counted from the NEWEST record backwards until the first divergence.
 * @property {number} divergencesInWindow - divergences among the trailing `windowSize` records.
 * @property {number} windowSize - how many records the window actually held (min(records.length, M)).
 * @property {number} decided - total decided decisions on the ledger.
 * @property {number} N - the required consecutive-match count.
 * @property {number} M - the trailing window the zero-divergence bar is measured over.
 * @property {boolean} flipReady - the GATE: `consecutiveMatches >= N && divergencesInWindow === 0`.
 * @property {string} answer - a session-free, human-readable answer to "how many consecutive matches, 0 divergences?"
 */

/**
 * COMPUTE the named confidence metric (#2754) — "how many consecutive shadow-vs-human MATCHES, with ZERO divergences,
 * over the last M decided decisions?" PURE, readable WITHOUT a session (a script/CLI reads the ledger and answers).
 * This is the gate the flip is defined behind. Two conditions, both explicit so `M` is meaningful even when it equals
 * `N`: (1) the most-recent `consecutiveMatches` streak reaches `N`; (2) the trailing `M`-record window holds ZERO
 * divergences. A single divergence anywhere in the streak resets condition 1; a divergence anywhere in the window
 * fails condition 2 — either blocks the flip.
 * @param {Array<ShadowOutcomeRecord>} records - the shadow-vs-human agreement ledger, oldest→newest.
 * @param {{ N?: number, M?: number }} [trigger] - defaults to `ENFORCE_FLIP_TRIGGER`.
 * @returns {AgreementMetric}
 */
export function computeAgreementMetric(records = [], { N = ENFORCE_FLIP_TRIGGER.N, M = ENFORCE_FLIP_TRIGGER.M } = {}) {
  const list = Array.isArray(records) ? records : [];
  let consecutiveMatches = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (recordIsMatch(list[i])) consecutiveMatches++;
    else break;
  }
  const window = M > 0 ? list.slice(-M) : [];
  const divergencesInWindow = window.reduce((n, r) => n + (recordIsMatch(r) ? 0 : 1), 0);
  const flipReady = consecutiveMatches >= N && divergencesInWindow === 0;
  const answer = `${consecutiveMatches}/${N} consecutive matches, ${divergencesInWindow} divergence(s) in the last ${window.length}/${M} decided → ${flipReady ? 'FLIP-READY' : 'below trigger'}`;
  return { consecutiveMatches, divergencesInWindow, windowSize: window.length, decided: list.length, N, M, flipReady, answer };
}

/**
 * @typedef {Object} LandModeResolution
 * @property {'shadow'|'enforce'} mode - the EFFECTIVE land mode to feed the #2704 disposer.
 * @property {AgreementMetric} metric - the confidence metric that gated the decision (always computed, always readable).
 * @property {string} reason - a machine token: `metric-green`, `metric-below-trigger`, `operator-shadow-ceiling`, or
 *   `metric-green-but-operator-shadow` (the metric would flip but the operator knob is holding it observe-only).
 * @property {string[]} trail - a human-readable why.
 */

/**
 * RESOLVE the effective land mode from the confidence metric (#2754) — THE FLIP, defined as one gated ruling. PURE.
 * The metric is the AUTOMATIC trigger: `enforce` iff `metric.flipReady`. The operator's global `landMode` knob
 * (#2675, resolved from the disposition config) is a fail-safe CEILING — it can only ever hold the mode DOWN to
 * `shadow`, NEVER force `enforce` past a red metric. This mirrors `planDecision`'s `humanRequired` floor: a knob may
 * add safety, never remove it. Net effect: shipping with the ratified default (`configMode: shadow`) keeps production
 * observe-only and changes NOTHING today; once the operator ARMS the flip (`configMode: enforce`), the metric decides
 * moment-to-moment — enforce only while the streak holds, and it auto-drops back to shadow the instant a divergence
 * resets the counter. That is the "one-line ruling gated on the metric, blocked by any divergence."
 * @param {{ records?: Array<ShadowOutcomeRecord>, configMode?: string, trigger?: {N?:number,M?:number} }} o -
 *   `records` is the shadow-vs-human agreement ledger; `configMode` is the resolved global `landMode` (`shadow` |
 *   `enforce`; anything else → shadow); `trigger` overrides N/M for a re-tune/test.
 * @returns {LandModeResolution}
 */
export function resolveLandMode({ records = [], configMode, trigger } = {}) {
  const metric = computeAgreementMetric(records, trigger || {});
  const ceiling = configMode === LAND_MODES.ENFORCE ? LAND_MODES.ENFORCE : LAND_MODES.SHADOW;
  // The operator knob is a fail-safe ceiling: an un-armed (shadow) global stance holds observe-only regardless of how
  // green the metric is — the flip requires BOTH the operator arming it AND the metric earning it.
  if (ceiling === LAND_MODES.SHADOW) {
    return {
      mode: LAND_MODES.SHADOW,
      metric,
      reason: metric.flipReady ? 'metric-green-but-operator-shadow' : 'operator-shadow-ceiling',
      trail: [
        metric.answer,
        metric.flipReady
          ? 'metric is FLIP-READY, but the operator landMode is shadow (un-armed) — held observe-only (arm with landMode: enforce).'
          : 'operator landMode is shadow and the metric is below trigger — observe-only.',
      ],
    };
  }
  // Operator has ARMED enforce — the metric is now the moment-to-moment gate.
  return metric.flipReady
    ? { mode: LAND_MODES.ENFORCE, metric, reason: 'metric-green', trail: [metric.answer, 'operator armed + metric FLIP-READY → ENFORCE (auto-ratify, no human in the loop).'] }
    : { mode: LAND_MODES.SHADOW, metric, reason: 'metric-below-trigger', trail: [metric.answer, 'operator armed but the metric is below trigger → held SHADOW until the streak rebuilds.'] };
}

/**
 * ROUTE + DISPOSE in one call (#2704) — the whole deterministic core of the operator's ruling for one decision.
 * PURE. Always returns the ROUTE (which process to run). If a jury LEDGER from that process is supplied, it ALSO
 * returns the DISPOSITION plan (ratify shadow-first / escalate); with no ledger yet (the process has not run) the
 * disposition is null and the caller runs the routed process first, then calls back with its ledger. This is the
 * one function the shell shells per decision.
 * When `agreementRecords` is supplied, the effective land `mode` is RESOLVED through the #2754 shadow→enforce flip
 * (`resolveLandMode`): the passed `mode` becomes the operator CEILING, and the confidence metric gates whether it may
 * actually reach `enforce`. With no `agreementRecords`, the passed `mode` is used directly (backward-compatible) —
 * a caller that has already resolved the mode does not have to re-supply the ledger.
 * @param {{ signals?: object, humanRequired?: boolean, ledger?: Array<object>|null, config?: object,
 *   dispositionSignals?: object, mandatoryLenses?: string[], mode?: string,
 *   agreementRecords?: Array<ShadowOutcomeRecord>|null, trigger?: {N?:number,M?:number} }} o
 * @returns {{ route: DecisionRoutePlan, disposition: (ReturnType<typeof disposeDecisionRuling>|null),
 *   landMode: (LandModeResolution|null) }}
 */
export function planDecision({ signals = {}, humanRequired = false, ledger = null, config, dispositionSignals, mandatoryLenses, mode, agreementRecords = null, trigger } = {}) {
  const route = routeDecision({ signals, humanRequired });
  // #2754 FLIP: when an agreement ledger is supplied, the metric gates the mode (the passed `mode` is the operator
  // ceiling). This is the ONE place the flip is applied in the core — mechanical once the gate is green.
  const landMode = Array.isArray(agreementRecords)
    ? resolveLandMode({ records: agreementRecords, configMode: mode, trigger })
    : null;
  const effectiveMode = landMode ? landMode.mode : mode;
  let disposition = null;
  if (Array.isArray(ledger) && config) {
    // HARD-INVARIANT SAFETY — thread the routing `humanRequired` into the judge's hard-escalate signals so a
    // statute / policy-tier decision can NEVER auto-ratify, even if the caller forgot to repeat it in
    // `dispositionSignals`. `humanRequired` here is a FLOOR: an explicit `dispositionSignals.humanRequired`
    // stays true, and the routing flag can only ADD the human gate, never clear it. Without this a caller that
    // set `humanRequired` for routing but omitted `dispositionSignals` would bypass the judge's step-1 invariant.
    const ds = dispositionSignals && typeof dispositionSignals === 'object' ? dispositionSignals : {};
    disposition = disposeDecisionRuling({
      ledger,
      config,
      signals: { ...ds, humanRequired: humanRequired === true || ds.humanRequired === true },
      mandatoryLenses: mandatoryLenses ?? route.mandatoryLenses,
      mode: effectiveMode,
    });
  }
  return { route, disposition, landMode };
}
