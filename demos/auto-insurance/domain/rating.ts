/**
 * Rating + underwriting engine. Derives a 6-month premium from rating factors (the premium breakdown)
 * AND runs eligibility/UW rules that emit an explainable decision trace (the decision-trace standard).
 * Rules-as-data-ish; versioned for reproducibility. Approximated, not a real rating plan.
 */

import type { Policy, RatingResult, RatingFactor, UwCriterion, UwFinding, RuleOutcome, Op } from './types';

export const RULE_SET_VERSION = '2026.06.0';
const BASE_PREMIUM = 600;

const TERRITORY_MULT: Record<string, number> = {
  'T1': 0.85, 'T2': 0.95, 'T3': 1.0, 'T4': 1.15, 'T5': 1.35,
};

const hasCov = (p: Policy, id: string): boolean => p.coverages.some((c) => c.id === id);
const totalIncidents = (p: Policy): number => p.drivers.reduce((s, d) => s + d.incidents, 0);
const maxSymbol = (p: Policy): number => Math.max(...p.vehicles.map((v) => v.symbol));
const maxMiles = (p: Policy): number => Math.max(...p.vehicles.map((v) => v.annualMiles));

/** The premium breakdown — multiplicative rating factors over the base. */
function ratingFactors(p: Policy): RatingFactor[] {
  const exp = p.insured.licenseYears;
  const inc = totalIncidents(p);
  const sym = maxSymbol(p);
  const miles = maxMiles(p);
  return [
    { id: 'experience', label: 'Driving experience', input: `${exp} yrs`, basis: 'years licensed',
      multiplier: exp < 3 ? 1.6 : exp < 6 ? 1.25 : exp >= 25 ? 1.1 : 1.0 },
    { id: 'incidents', label: 'Incident surcharge', input: inc, basis: 'at-fault + violations (5y)',
      multiplier: 1 + inc * 0.25 },
    { id: 'symbol', label: 'Vehicle symbol', input: sym, basis: 'ISO rating symbol',
      multiplier: 0.8 + sym * 0.03 },
    { id: 'mileage', label: 'Annual mileage', input: miles, basis: 'garaged use',
      multiplier: miles > 15000 ? 1.15 : miles < 7500 ? 0.9 : 1.0 },
    { id: 'territory', label: 'Territory', input: p.territory, basis: 'garaging ZIP band',
      multiplier: TERRITORY_MULT[p.territory] ?? 1.0 },
    { id: 'coverage', label: 'Physical-damage coverage', input: covSummary(p), basis: 'collision/comp',
      multiplier: 1 + (hasCov(p, 'collision') ? 0.35 : 0) + (hasCov(p, 'comprehensive') ? 0.2 : 0) },
    { id: 'continuity', label: p.priorLapse ? 'Lapse surcharge' : 'Continuous-coverage discount',
      input: p.priorLapse ? 'lapse' : 'continuous', basis: 'prior coverage',
      multiplier: p.priorLapse ? 1.2 : 0.95 },
  ];
}

function covSummary(p: Policy): string {
  const phys = [hasCov(p, 'collision') && 'coll', hasCov(p, 'comprehensive') && 'comp'].filter(Boolean);
  return phys.length ? phys.join('+') : 'liability-only';
}

const test = (op: Op, value: number, threshold: number): boolean => {
  switch (op) {
    case 'lte': return value <= threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'gt': return value > threshold;
    case 'eq': return value === threshold;
    case 'isFalse': return value < 1;
  }
};

/** The underwriting decision trace — eligibility criteria → pass/refer/fail with reason codes. */
function underwrite(p: Policy): { finding: UwFinding; trace: UwCriterion[]; reasonCodes: string[] } {
  const inc = totalIncidents(p);
  const sym = maxSymbol(p);
  const defs: Array<{ id: string; label: string; factName: string; value: number; op: Op; threshold: number; refer?: number; severe?: boolean; reason: string }> = [
    { id: 'incidents', label: 'Incident count', factName: 'incidents', value: inc, op: 'lte', threshold: 1, refer: 3, severe: true, reason: 'EXCESS-INCIDENTS' },
    { id: 'experience', label: 'Years licensed', factName: 'licenseYears', value: p.insured.licenseYears, op: 'gte', threshold: 3, refer: 1, severe: true, reason: 'INEXPERIENCED' },
    { id: 'symbol', label: 'Vehicle symbol cap', factName: 'symbol', value: sym, op: 'lte', threshold: 20, refer: 24, reason: 'HIGH-VALUE-VEHICLE' },
    { id: 'continuity', label: 'No prior lapse', factName: 'priorLapse', value: p.priorLapse ? 1 : 0, op: 'isFalse', threshold: 0, reason: 'PRIOR-LAPSE' },
  ];
  const trace: UwCriterion[] = defs.map((d) => {
    let outcome: RuleOutcome;
    if (test(d.op, d.value, d.threshold)) outcome = 'pass';
    else if (d.refer != null && test(d.op, d.value, d.refer)) outcome = 'refer';
    else outcome = d.severe ? 'fail' : 'refer';
    return { ruleId: d.id, label: d.label, factName: d.factName, factValue: d.value, op: d.op,
      thresholdValue: d.threshold, outcome, reasonCode: outcome === 'pass' ? undefined : d.reason };
  });
  const reasonCodes = trace.filter((r) => r.reasonCode).map((r) => r.reasonCode!);
  let finding: UwFinding;
  if (trace.some((r) => r.outcome === 'fail')) finding = 'decline';
  else {
    const refers = trace.filter((r) => r.outcome === 'refer').length;
    finding = refers >= 2 ? 'refer' : refers === 1 ? 'accept' : 'preferred';
  }
  return { finding, trace, reasonCodes };
}

export function rate(p: Policy, version: string = RULE_SET_VERSION): RatingResult {
  const factors = ratingFactors(p);
  const premium = Math.round(BASE_PREMIUM * factors.reduce((m, f) => m * f.multiplier, 1));
  const { finding, trace, reasonCodes } = underwrite(p);
  return { base: BASE_PREMIUM, factors, premium, finding, trace, reasonCodes, ruleSetVersion: version };
}

/** Tier → status-indicator tone (passed to renderDecisionTrace as the toneFor override). */
export const FINDING_TONE: Record<UwFinding, 'positive' | 'caution' | 'critical' | 'neutral'> = {
  preferred: 'positive', accept: 'positive', refer: 'caution', decline: 'critical',
};
export const FINDING_LABEL: Record<UwFinding, string> = {
  preferred: 'Preferred', accept: 'Accept', refer: 'Refer to UW', decline: 'Decline',
};
