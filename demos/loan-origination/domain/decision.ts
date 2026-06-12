/**
 * toDecisionRecord — normalize the loan rules-engine result into the Web Decisions standard's
 * `DecisionRecord` (the decision-record protocol / #355). The engine stays app-domain; this maps its
 * output onto the shared interchange schema so the decision-trace block (and audit / reporting) consume it.
 */

import type { Application } from './types';
import type { EvaluationResult } from './rules';
import type { DecisionRecord } from '../../../blocks/renderers/decision-trace/renderDecisionTrace';

const OP_SYMBOL: Record<string, string> = { lte: '≤', gte: '≥', lt: '<', gt: '>', eq: '=', isTrue: 'is' };

export function toDecisionRecord(
  app: Application,
  result: EvaluationResult,
  format: (factName: string, value: number) => string,
): DecisionRecord {
  return {
    subject: { type: 'loan', id: app.loanNumber },
    ruleSet: { id: 'aus', version: result.ruleSetVersion },
    outcome: result.finding,
    reasonCodes: result.reasonCodes,
    criteria: result.trace.map((r) => ({
      id: r.ruleId,
      label: r.label,
      input: { name: r.factName, value: format(r.factName, r.factValue) },
      operator: OP_SYMBOL[r.op] ?? r.op,
      threshold: format(r.factName, r.thresholdValue),
      outcome: r.outcome,
      reasonCode: r.reasonCode,
    })),
  };
}
