/**
 * Rules-as-data engine (M6) + proof-of-compliance trace.
 *
 * A rule is a declarative predicate over a named underwriting fact compared to a threshold (which
 * may itself be another fact, e.g. the product's maxLTV). Rules are DATA: the catalog is versioned
 * and Admin-editable without a code change. The same predicate shape powers the product configurator
 * constraints (M5) — see backlog #317 settled decision #2.
 */

import type { Finding } from './types';
import type { UnderwritingFacts } from './facts';
import { deriveFacts } from './facts';
import type { Application } from './types';

export type Op = 'lte' | 'gte' | 'lt' | 'gt' | 'eq' | 'isTrue';

/** Outcome a single rule contributes when it does NOT pass. */
export type RuleSeverity = 'refer' | 'fail';

export interface Rule {
  id: string;
  label: string;
  /** Fact being tested. */
  fact: keyof UnderwritingFacts;
  op: Op;
  /** Literal threshold, or the name of another fact to compare against. */
  threshold: number | { factRef: keyof UnderwritingFacts };
  /** If the predicate is false, this is the contributed outcome. */
  severityIfFail: RuleSeverity;
  /** Optional softer threshold that downgrades a fail to a refer (compensating factors). */
  referThreshold?: number;
  reasonCode: string;
}

export interface RuleSet {
  version: string;
  rules: Rule[];
}

/**
 * Default rule set. Thresholds illustrative; in the full app these live in an Admin-editable,
 * versioned config that extends a platform default.
 */
export const DEFAULT_RULE_SET: RuleSet = {
  version: '2026.06.0',
  rules: [
    { id: 'back-end-dti', label: 'Back-end DTI', fact: 'backEndDTI', op: 'lte', threshold: 0.43, referThreshold: 0.5, severityIfFail: 'fail', reasonCode: 'DTI-HIGH' },
    { id: 'front-end-dti', label: 'Front-end (housing) DTI', fact: 'frontEndDTI', op: 'lte', threshold: 0.36, severityIfFail: 'refer', reasonCode: 'HOUSING-DTI-HIGH' },
    { id: 'ltv-ceiling', label: 'LTV within product limit', fact: 'ltv', op: 'lte', threshold: { factRef: 'productMaxLTV' }, severityIfFail: 'fail', reasonCode: 'LTV-OVER' },
    { id: 'min-score', label: 'Credit score meets product minimum', fact: 'representativeCreditScore', op: 'gte', threshold: { factRef: 'productMinScore' }, severityIfFail: 'fail', reasonCode: 'SCORE-LOW' },
    { id: 'reserves', label: 'Reserves meet product minimum', fact: 'reserveMonths', op: 'gte', threshold: { factRef: 'productMinReserveMonths' }, severityIfFail: 'refer', reasonCode: 'RESERVES-SHORT' },
    { id: 'income-stability', label: 'Employment stability (24mo)', fact: 'minMonthsOnJob', op: 'gte', threshold: 24, severityIfFail: 'refer', reasonCode: 'JOB-TIME-SHORT' },
    { id: 'down-payment', label: 'Down payment / cash-to-close covered', fact: 'downPaymentCovered', op: 'isTrue', threshold: 1, severityIfFail: 'fail', reasonCode: 'INSUFFICIENT-FUNDS' },
  ],
};

export type RuleOutcome = 'pass' | 'refer' | 'fail';

export interface RuleResult {
  ruleId: string;
  label: string;
  factName: string;
  factValue: number;
  op: Op;
  thresholdValue: number;
  outcome: RuleOutcome;
  reasonCode?: string;
}

export interface EvaluationResult {
  finding: Finding;
  ruleSetVersion: string;
  /** The proof-of-compliance trace: every rule, its inputs, threshold, and outcome. */
  trace: RuleResult[];
  reasonCodes: string[];
}

function resolveThreshold(rule: Rule, facts: UnderwritingFacts): number {
  return typeof rule.threshold === 'number' ? rule.threshold : (facts[rule.threshold.factRef] as number);
}

function predicate(op: Op, value: number, threshold: number): boolean {
  switch (op) {
    case 'lte': return value <= threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'gt': return value > threshold;
    case 'eq': return value === threshold;
    case 'isTrue': return value >= 1;
  }
}

function evalRule(rule: Rule, facts: UnderwritingFacts): RuleResult {
  const rawValue = facts[rule.fact];
  const factValue = typeof rawValue === 'boolean' ? (rawValue ? 1 : 0) : (rawValue as number);
  const thresholdValue = resolveThreshold(rule, facts);

  let outcome: RuleOutcome;
  if (predicate(rule.op, factValue, thresholdValue)) {
    outcome = 'pass';
  } else if (rule.referThreshold != null && predicate(rule.op, factValue, rule.referThreshold)) {
    // Between the strict and the compensating-factor threshold -> refer, not fail.
    outcome = 'refer';
  } else {
    outcome = rule.severityIfFail === 'fail' ? 'fail' : 'refer';
  }

  return {
    ruleId: rule.id,
    label: rule.label,
    factName: rule.fact,
    factValue,
    op: rule.op,
    thresholdValue,
    outcome,
    reasonCode: outcome === 'pass' ? undefined : rule.reasonCode,
  };
}

/** Aggregate rule outcomes into an AUS-style finding. */
function aggregate(trace: RuleResult[]): Finding {
  if (trace.some((r) => r.outcome === 'fail')) return 'ineligible';
  const refers = trace.filter((r) => r.outcome === 'refer').length;
  if (refers >= 2) return 'refer-with-caution';
  if (refers === 1) return 'refer';
  return 'approve-eligible';
}

export function evaluate(app: Application, ruleSet: RuleSet = DEFAULT_RULE_SET): EvaluationResult {
  const facts = deriveFacts(app);
  const trace = ruleSet.rules.map((r) => evalRule(r, facts));
  return {
    finding: aggregate(trace),
    ruleSetVersion: ruleSet.version,
    trace,
    reasonCodes: trace.filter((r) => r.reasonCode).map((r) => r.reasonCode!),
  };
}
