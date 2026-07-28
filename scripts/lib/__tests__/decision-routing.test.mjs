/**
 * @file decision-routing.test.mjs — proof of the #2704 decision-routing core (route a cleared decision by
 *   criticality/complexity to red-team convergence or a design committee; dispose a converged ruling shadow-first;
 *   escalate only on genuine non-convergence). Covers: classification off the REUSED care-level signals (no new
 *   score), the route rubric (bounded → red-team; complex/critical → committee; humanRequired always committee),
 *   the shadow-first disposition (shadow observes, enforce ratifies, escalate on non-convergence / gate-self /
 *   judge-error), and the combined planDecision. Pure module — plain unit assertions.
 */
import { describe, it, expect } from 'vitest';
import {
  DECISION_PROCESSES,
  RULING_ACTIONS,
  COMPLEXITY_CARE_FLOOR,
  SHADOW_OUTCOMES,
  ENFORCE_FLIP_TRIGGER,
  classifyDecisionCriticality,
  routeDecision,
  decideDecisionDisposition,
  disposeDecisionRuling,
  planDecision,
  recordShadowOutcome,
  computeAgreementMetric,
  resolveLandMode,
} from '../decision-routing.mjs';
import { DISPOSITIONS } from '../disposition-judge.mjs';
import { LAND_MODES } from '../auto-land-seam.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { VERDICTS } from '../jury-core.mjs';
import { CARE_LEVELS } from '../review-escalation.mjs';

// The lenses a DECISION jury covers (#2657): root-cause + completeness — NOT the PR-review default.
const DECISION_LENSES = ['root-cause', 'completeness'];

// --- jury-ledger builders (mirror disposition-judge.test.mjs) --------------------------------------------------
const CHARTER = 'judge';
function rosterEvent(jurors, round = 0) { return { type: 'roster-picked', round, jurors }; }
function verdictEvent(jurorId, verdict, round = 0) { return { type: 'verdict', round, jurorId, verdict }; }

/** A clean two-mandatory-lens ledger, TWO diverse jurors per lens all accepting (no thin-jury refutation). */
function cleanDiverseLedger(verdict = VERDICTS.ACCEPT) {
  const jurors = [];
  const verdicts = [];
  for (const lens of DECISION_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, verdict));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

const DEFAULT_CONFIG = resolveDispositionConfig(); // present-unless-all-agree, dissentThreshold 0

describe('enums', () => {
  it('names exactly the two processes, frozen', () => {
    expect(DECISION_PROCESSES).toEqual({ RED_TEAM_CONVERGENCE: 'red-team-convergence', DESIGN_COMMITTEE: 'design-committee' });
    expect(Object.isFrozen(DECISION_PROCESSES)).toBe(true);
  });
  it('names exactly the two ruling actions, frozen', () => {
    expect(RULING_ACTIONS).toEqual({ RATIFY: 'ratify', ESCALATE: 'escalate' });
    expect(Object.isFrozen(RULING_ACTIONS)).toBe(true);
  });
  it('the complexity floor is the elevated care band', () => {
    expect(COMPLEXITY_CARE_FLOOR).toBe(CARE_LEVELS.ELEVATED);
  });
});

describe('classifyDecisionCriticality — reuses the care-level signal, no new score', () => {
  it('no scored signal → none, not critical, not complex (bounded)', () => {
    const c = classifyDecisionCriticality({ signals: {}, humanRequired: false });
    expect(c.careLevel).toBe(CARE_LEVELS.NONE);
    expect(c.critical).toBe(false);
    expect(c.complex).toBe(false);
  });

  it('a blast-radius signal alone lands at elevated → complex, not critical', () => {
    const c = classifyDecisionCriticality({ signals: { blastRadius: true } });
    expect(c.careLevel).toBe(CARE_LEVELS.ELEVATED);
    expect(c.complex).toBe(true);
    expect(c.critical).toBe(false);
  });

  it('a size signal alone lands at low → neither complex nor critical', () => {
    const c = classifyDecisionCriticality({ signals: { size: 500 } });
    expect(c.careLevel).toBe(CARE_LEVELS.LOW);
    expect(c.complex).toBe(false);
    expect(c.critical).toBe(false);
  });

  it('humanRequired (statute / policy-tier subject) → high, critical, complex', () => {
    const c = classifyDecisionCriticality({ signals: {}, humanRequired: true });
    expect(c.careLevel).toBe(CARE_LEVELS.HIGH);
    expect(c.critical).toBe(true);
    expect(c.complex).toBe(true);
  });

  it('enough stacked scored signals reach the high band → critical', () => {
    // dismissed(>1)=5 + blastRadius 3 = 8 ≥ CARE_BANDS.high(5) → high
    const c = classifyDecisionCriticality({ signals: { dismissedFindings: 2, blastRadius: true } });
    expect(c.careLevel).toBe(CARE_LEVELS.HIGH);
    expect(c.critical).toBe(true);
  });
});

describe('routeDecision — the operator ruling, coded', () => {
  it('a bounded (none/low) decision → red-team convergence', () => {
    const r = routeDecision({ signals: {} });
    expect(r.process).toBe(DECISION_PROCESSES.RED_TEAM_CONVERGENCE);
    expect(r.reason).toBe('bounded');
    const rLow = routeDecision({ signals: { size: 500 } });
    expect(rLow.process).toBe(DECISION_PROCESSES.RED_TEAM_CONVERGENCE);
  });

  it('a complex (elevated) decision → design committee', () => {
    const r = routeDecision({ signals: { blastRadius: true } });
    expect(r.process).toBe(DECISION_PROCESSES.DESIGN_COMMITTEE);
    expect(r.reason).toBe('complex');
  });

  it('a critical (humanRequired) decision → design committee, reason critical', () => {
    const r = routeDecision({ signals: {}, humanRequired: true });
    expect(r.process).toBe(DECISION_PROCESSES.DESIGN_COMMITTEE);
    expect(r.reason).toBe('critical');
  });

  it('carries the #2657 decision-prose mandatory lenses on both routes', () => {
    expect(routeDecision({ signals: {} }).mandatoryLenses).toEqual(['root-cause', 'completeness']);
    expect(routeDecision({ signals: { blastRadius: true } }).mandatoryLenses).toEqual(['root-cause', 'completeness']);
  });

  it('accepts a pre-computed classification', () => {
    const cls = classifyDecisionCriticality({ signals: { blastRadius: true } });
    expect(routeDecision({ classification: cls }).process).toBe(DECISION_PROCESSES.DESIGN_COMMITTEE);
  });
});

describe('decideDecisionDisposition — shadow-first over a judge verdict', () => {
  const autoDispose = { disposition: DISPOSITIONS.AUTO_DISPOSE, reason: 'unanimous-accept', trail: ['clean'] };
  const escalate = { disposition: DISPOSITIONS.ESCALATE, reason: 'dissent-present', trail: ['contested'] };

  it('shadow (default) + auto-dispose → RATIFY but apply:false (would-ratify logged)', () => {
    const p = decideDecisionDisposition({ verdict: autoDispose });
    expect(p.mode).toBe(LAND_MODES.SHADOW);
    expect(p.action).toBe(RULING_ACTIONS.RATIFY);
    expect(p.apply).toBe(false);
    expect(p.observation).toMatch(/SHADOW/);
  });

  it('enforce + auto-dispose → RATIFY, apply:true', () => {
    const p = decideDecisionDisposition({ verdict: autoDispose, mode: LAND_MODES.ENFORCE });
    expect(p.mode).toBe(LAND_MODES.ENFORCE);
    expect(p.action).toBe(RULING_ACTIONS.RATIFY);
    expect(p.apply).toBe(true);
  });

  it('escalate verdict → ESCALATE, apply:false, in either mode', () => {
    for (const mode of [LAND_MODES.SHADOW, LAND_MODES.ENFORCE]) {
      const p = decideDecisionDisposition({ verdict: escalate, mode });
      expect(p.action).toBe(RULING_ACTIONS.ESCALATE);
      expect(p.apply).toBe(false);
    }
  });

  it('an unknown mode normalizes to shadow (fail-closed — never accidentally enforce)', () => {
    const p = decideDecisionDisposition({ verdict: autoDispose, mode: 'yolo' });
    expect(p.mode).toBe(LAND_MODES.SHADOW);
    expect(p.apply).toBe(false);
  });

  it('a malformed verdict → ESCALATE (fail-closed)', () => {
    expect(decideDecisionDisposition({ verdict: null }).action).toBe(RULING_ACTIONS.ESCALATE);
    expect(decideDecisionDisposition({ verdict: {} }).action).toBe(RULING_ACTIONS.ESCALATE);
  });
});

describe('disposeDecisionRuling — end-to-end over a jury ledger', () => {
  it('a clean converged ledger, shadow → RATIFY apply:false (a human still confirms)', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG });
    expect(plan.action).toBe(RULING_ACTIONS.RATIFY);
    expect(plan.apply).toBe(false);
    expect(plan.verdict.disposition).toBe(DISPOSITIONS.AUTO_DISPOSE);
  });

  it('a clean converged ledger, enforce → RATIFY apply:true', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, mode: LAND_MODES.ENFORCE });
    expect(plan.action).toBe(RULING_ACTIONS.RATIFY);
    expect(plan.apply).toBe(true);
  });

  it('genuine non-convergence (a changes verdict) → ESCALATE', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(VERDICTS.CHANGES), config: DEFAULT_CONFIG });
    expect(plan.action).toBe(RULING_ACTIONS.ESCALATE);
  });

  it('a nonConvergence signal → ESCALATE even over a clean ledger', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { nonConvergence: true } });
    expect(plan.action).toBe(RULING_ACTIONS.ESCALATE);
  });

  it('a gate-self signal → ESCALATE, never auto-ratify (the hard invariant), even in enforce', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, signals: { gateSelf: true }, mode: LAND_MODES.ENFORCE });
    expect(plan.action).toBe(RULING_ACTIONS.ESCALATE);
    expect(plan.apply).toBe(false);
  });

  it('a bad config makes the judge throw → ESCALATE (fail-closed), verdict null', () => {
    const plan = disposeDecisionRuling({ ledger: cleanDiverseLedger(), config: null });
    expect(plan.action).toBe(RULING_ACTIONS.ESCALATE);
    expect(plan.reason).toBe('judge-error');
    expect(plan.verdict).toBeNull();
  });
});

describe('planDecision — route + (optional) dispose in one call', () => {
  it('no ledger → route only, disposition null', () => {
    const { route, disposition } = planDecision({ signals: { blastRadius: true } });
    expect(route.process).toBe(DECISION_PROCESSES.DESIGN_COMMITTEE);
    expect(disposition).toBeNull();
  });

  it('with a ledger + config → route AND disposition', () => {
    const { route, disposition } = planDecision({
      signals: {}, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG,
    });
    expect(route.process).toBe(DECISION_PROCESSES.RED_TEAM_CONVERGENCE);
    expect(disposition.action).toBe(RULING_ACTIONS.RATIFY);
    expect(disposition.apply).toBe(false); // shadow default
  });

  it('a ledger without a config stays route-only (no half-run disposition)', () => {
    const { disposition } = planDecision({ signals: {}, ledger: cleanDiverseLedger() });
    expect(disposition).toBeNull();
  });

  it('humanRequired threads into the judge — a policy-tier decision never auto-ratifies, even in enforce', () => {
    // Regression for the hard-invariant fail-open: humanRequired routes to the committee AND must force escalate,
    // even when the caller omits dispositionSignals and the mode is enforce over a clean converged ledger.
    const { route, disposition } = planDecision({
      humanRequired: true,
      ledger: cleanDiverseLedger(),
      config: DEFAULT_CONFIG,
      mode: LAND_MODES.ENFORCE,
    });
    expect(route.process).toBe(DECISION_PROCESSES.DESIGN_COMMITTEE);
    expect(disposition.action).toBe(RULING_ACTIONS.ESCALATE);
    expect(disposition.apply).toBe(false);
  });

  it('an explicit dispositionSignals.humanRequired is preserved (routing flag is a floor, not a clear)', () => {
    const { disposition } = planDecision({
      signals: {}, dispositionSignals: { humanRequired: true },
      ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, mode: LAND_MODES.ENFORCE,
    });
    expect(disposition.action).toBe(RULING_ACTIONS.ESCALATE);
  });
});

// ================================================================================================================
// #2754 — the shadow→enforce flip: per-decision shadow-vs-human outcome, the confidence metric, and the gated flip.
// ================================================================================================================

const { RATIFY, ESCALATE } = RULING_ACTIONS;
/** N MATCH records (default) — the newest-first streak the flip reads. */
function matches(n, action = RATIFY) { return Array.from({ length: n }, () => recordShadowOutcome({ shadowAction: action, humanAction: action })); }
const DIVERGE = recordShadowOutcome({ shadowAction: RATIFY, humanAction: ESCALATE });

describe('#2754 shadow-vs-human outcome record', () => {
  it('the outcome enum names exactly match/divergence, frozen', () => {
    expect(SHADOW_OUTCOMES).toEqual({ MATCH: 'match', DIVERGENCE: 'divergence' });
    expect(Object.isFrozen(SHADOW_OUTCOMES)).toBe(true);
  });

  it('equal valid actions → MATCH (class agreement), both ratify and both escalate', () => {
    expect(recordShadowOutcome({ shadowAction: RATIFY, humanAction: RATIFY }).outcome).toBe(SHADOW_OUTCOMES.MATCH);
    expect(recordShadowOutcome({ shadowAction: ESCALATE, humanAction: ESCALATE }).match).toBe(true);
  });

  it('disagreement in EITHER direction → DIVERGENCE (strictest safe predicate)', () => {
    expect(recordShadowOutcome({ shadowAction: RATIFY, humanAction: ESCALATE }).outcome).toBe(SHADOW_OUTCOMES.DIVERGENCE);
    expect(recordShadowOutcome({ shadowAction: ESCALATE, humanAction: RATIFY }).outcome).toBe(SHADOW_OUTCOMES.DIVERGENCE);
  });

  it('a malformed/partial input can NEVER inflate the streak — it fails closed to DIVERGENCE', () => {
    expect(recordShadowOutcome({ shadowAction: RATIFY }).outcome).toBe(SHADOW_OUTCOMES.DIVERGENCE); // human missing
    expect(recordShadowOutcome({ shadowAction: 'bogus', humanAction: RATIFY }).match).toBe(false);
    expect(recordShadowOutcome({}).outcome).toBe(SHADOW_OUTCOMES.DIVERGENCE);
    expect(recordShadowOutcome().outcome).toBe(SHADOW_OUTCOMES.DIVERGENCE);
  });

  it('accepts the disposition PLAN objects directly (reads .action)', () => {
    const rec = recordShadowOutcome({ shadowPlan: { action: RATIFY }, humanPlan: { action: RATIFY } });
    expect(rec.match).toBe(true);
  });

  it('the record is frozen', () => {
    expect(Object.isFrozen(recordShadowOutcome({ shadowAction: RATIFY, humanAction: RATIFY }))).toBe(true);
  });
});

describe('#2754 computeAgreementMetric — the named confidence gate', () => {
  it('the starting trigger is N=20, M=20, frozen', () => {
    expect(ENFORCE_FLIP_TRIGGER).toEqual({ N: 20, M: 20 });
    expect(Object.isFrozen(ENFORCE_FLIP_TRIGGER)).toBe(true);
  });

  it('an empty ledger is below trigger', () => {
    const m = computeAgreementMetric([]);
    expect(m.consecutiveMatches).toBe(0);
    expect(m.flipReady).toBe(false);
  });

  it('exactly N consecutive matches, zero divergences → FLIP-READY', () => {
    const m = computeAgreementMetric(matches(20));
    expect(m.consecutiveMatches).toBe(20);
    expect(m.divergencesInWindow).toBe(0);
    expect(m.flipReady).toBe(true);
  });

  it('N-1 matches is NOT ready (the bar is strict)', () => {
    expect(computeAgreementMetric(matches(19)).flipReady).toBe(false);
  });

  it('a single divergence resets the consecutive streak (newest-first) and blocks the flip', () => {
    // 20 old matches, then one divergence, then 19 fresh matches → streak only 19, and the window holds the divergence.
    const ledger = [...matches(20), DIVERGE, ...matches(19)];
    const m = computeAgreementMetric(ledger, { N: 20, M: 20 });
    expect(m.consecutiveMatches).toBe(19); // reset by the divergence
    expect(m.flipReady).toBe(false);
  });

  it('a divergence WITHIN the trailing window fails the zero-divergence bar even if the recent streak is long', () => {
    // custom small trigger: N=3, M=5. Newest 3 are matches (streak ok) but a divergence sits inside the last 5.
    const ledger = [...matches(2), DIVERGE, ...matches(3)];
    const m = computeAgreementMetric(ledger, { N: 3, M: 5 });
    expect(m.consecutiveMatches).toBe(3);
    expect(m.divergencesInWindow).toBe(1);
    expect(m.flipReady).toBe(false); // condition (2) fails
  });

  it('a malformed record in the streak breaks it (fail-closed)', () => {
    const ledger = [...matches(20), { junk: true }];
    expect(computeAgreementMetric(ledger).consecutiveMatches).toBe(0);
  });

  it('answers the "how many consecutive matches, zero divergences" question in plain text', () => {
    expect(computeAgreementMetric(matches(20)).answer).toMatch(/20\/20 consecutive matches, 0 divergence/);
  });
});

describe('#2754 resolveLandMode — the gated flip (operator ceiling × metric)', () => {
  it('operator un-armed (shadow) holds SHADOW even with a green metric', () => {
    const r = resolveLandMode({ records: matches(20), configMode: LAND_MODES.SHADOW });
    expect(r.mode).toBe(LAND_MODES.SHADOW);
    expect(r.reason).toBe('metric-green-but-operator-shadow');
    expect(r.metric.flipReady).toBe(true);
  });

  it('an unknown/typo operator mode fails closed to the shadow ceiling', () => {
    expect(resolveLandMode({ records: matches(20), configMode: 'ENFORCE!' }).mode).toBe(LAND_MODES.SHADOW);
    expect(resolveLandMode({ records: matches(20) }).mode).toBe(LAND_MODES.SHADOW); // undefined
  });

  it('operator ARMED + metric green → ENFORCE', () => {
    const r = resolveLandMode({ records: matches(20), configMode: LAND_MODES.ENFORCE });
    expect(r.mode).toBe(LAND_MODES.ENFORCE);
    expect(r.reason).toBe('metric-green');
  });

  it('operator armed but metric below trigger → held SHADOW until the streak rebuilds', () => {
    const r = resolveLandMode({ records: matches(19), configMode: LAND_MODES.ENFORCE });
    expect(r.mode).toBe(LAND_MODES.SHADOW);
    expect(r.reason).toBe('metric-below-trigger');
  });

  it('a single divergence in an armed+green run drops it back to SHADOW (the block)', () => {
    const ledger = [...matches(20), DIVERGE];
    expect(resolveLandMode({ records: ledger, configMode: LAND_MODES.ENFORCE }).mode).toBe(LAND_MODES.SHADOW);
  });
});

describe('#2754 planDecision — the flip mechanically gates the disposer', () => {
  it('armed + metric green → the converged ruling actually RATIFIES (apply:true)', () => {
    const { disposition, landMode } = planDecision({
      signals: {}, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG,
      mode: LAND_MODES.ENFORCE, agreementRecords: matches(20),
    });
    expect(landMode.mode).toBe(LAND_MODES.ENFORCE);
    expect(disposition.action).toBe(RULING_ACTIONS.RATIFY);
    expect(disposition.apply).toBe(true);
  });

  it('armed but a divergence blocks it → shadow, so apply stays false (would-ratify only)', () => {
    const { disposition, landMode } = planDecision({
      signals: {}, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG,
      mode: LAND_MODES.ENFORCE, agreementRecords: [...matches(20), DIVERGE],
    });
    expect(landMode.mode).toBe(LAND_MODES.SHADOW);
    expect(disposition.apply).toBe(false);
  });

  it('operator ceiling is fail-safe: even a green metric cannot force enforce past a shadow config', () => {
    const { disposition, landMode } = planDecision({
      signals: {}, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG,
      mode: LAND_MODES.SHADOW, agreementRecords: matches(20),
    });
    expect(landMode.mode).toBe(LAND_MODES.SHADOW);
    expect(disposition.apply).toBe(false);
  });

  it('no agreementRecords → backward-compatible: passed mode is used directly, landMode null', () => {
    const { disposition, landMode } = planDecision({
      signals: {}, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG, mode: LAND_MODES.ENFORCE,
    });
    expect(landMode).toBeNull();
    expect(disposition.apply).toBe(true); // unchanged #2704 behavior
  });

  it('the flip NEVER overrides the hard humanRequired invariant, even armed+green', () => {
    const { disposition } = planDecision({
      humanRequired: true, ledger: cleanDiverseLedger(), config: DEFAULT_CONFIG,
      mode: LAND_MODES.ENFORCE, agreementRecords: matches(20),
    });
    expect(disposition.action).toBe(RULING_ACTIONS.ESCALATE);
    expect(disposition.apply).toBe(false);
  });
});
