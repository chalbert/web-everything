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
  classifyDecisionCriticality,
  routeDecision,
  decideDecisionDisposition,
  disposeDecisionRuling,
  planDecision,
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
