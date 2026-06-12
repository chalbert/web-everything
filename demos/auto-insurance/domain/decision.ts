/**
 * toDecisionRecord — normalize the underwriting result into the Web Decisions standard's DecisionRecord
 * (the decision-record protocol / #355). Insurance is the SECOND consumer of decision-trace — a cross-app
 * conformance check of a standard the loan app drove.
 */

import type { Policy, RatingResult } from './types';
import type { DecisionRecord } from '../../../blocks/renderers/decision-trace/renderDecisionTrace';

const OP_SYMBOL: Record<string, string> = { lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=', isFalse: 'is no' };

export function toDecisionRecord(p: Policy, r: RatingResult): DecisionRecord {
  return {
    subject: { type: 'policy', id: p.policyNumber },
    ruleSet: { id: 'auto-uw', version: r.ruleSetVersion },
    outcome: r.finding,
    reasonCodes: r.reasonCodes,
    criteria: r.trace.map((c) => ({
      id: c.ruleId,
      label: c.label,
      input: { name: c.factName, value: c.op === 'isFalse' ? (c.factValue >= 1 ? 'lapse' : 'clean') : c.factValue },
      operator: OP_SYMBOL[c.op] ?? c.op,
      threshold: c.op === 'isFalse' ? 'lapse' : c.thresholdValue,
      outcome: c.outcome,
      reasonCode: c.reasonCode,
    })),
  };
}
