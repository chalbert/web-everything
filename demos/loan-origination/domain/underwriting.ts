/**
 * Phase S8 — underwriter workbench domain (#385): condition management + decisioning.
 *
 * Pure transitions over the existing `Condition` / `Decision` model. The underwriter clears or waives the
 * PTA/PTD/PTF conditions and then ISSUES a formal decision (approve-with-conditions / suspend / decline with
 * ECOA-style reason codes) — distinct from the rules-engine *finding* (the AUS recommendation): the finding
 * is the machine read, the decision is the human read. Audit + the decision-trace render stay in app.ts;
 * this module owns only the state math so it is testable without a DOM.
 */
import type { Condition, ConditionStatus, Decision, DecisionOutcome, Finding } from './types';
import type { EvaluationResult } from './rules';

function setStatus(conditions: Condition[], id: string, status: ConditionStatus): Condition[] {
  return conditions.map((c) => (c.id === id ? { ...c, status } : c));
}

/** Underwriter marks a satisfied condition cleared. */
export function clearCondition(conditions: Condition[], id: string): Condition[] {
  return setStatus(conditions, id, 'cleared');
}

/** Underwriter waives a condition (accepted without satisfaction — e.g. a compensating factor). */
export function waiveCondition(conditions: Condition[], id: string): Condition[] {
  return setStatus(conditions, id, 'waived');
}

/** A condition counts as resolved for the clear-to-close guard when cleared OR waived. */
export function conditionsAllResolved(conditions: Condition[]): boolean {
  return conditions.every((c) => c.status === 'cleared' || c.status === 'waived');
}

/** Open (unresolved) condition count, grouped by type, for the workbench summary. */
export function openConditionCounts(conditions: Condition[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of conditions) {
    if (c.status === 'cleared' || c.status === 'waived') continue;
    out[c.type] = (out[c.type] ?? 0) + 1;
  }
  return out;
}

/** The decision outcomes an underwriter can issue. */
export const DECISION_OUTCOMES: readonly DecisionOutcome[] = ['approve-with-conditions', 'suspend', 'decline'];

/**
 * Suggested ECOA-style adverse-action reason codes for a non-approval, seeded from the rules-engine
 * result's reason codes (the codes that drove a refer/ineligible finding). Approve-with-conditions needs
 * none. The underwriter may edit the set before issuing — this is only the default.
 */
export function suggestedReasonCodes(outcome: DecisionOutcome, result: EvaluationResult): string[] {
  if (outcome === 'approve-with-conditions') return [];
  return [...new Set(result.reasonCodes)];
}

/**
 * Build the formal `Decision` the underwriter issues. Pure — the caller stamps `decidedAt` (this module is
 * `Date`-free) and audits/notifies. `finding` carries the rules-engine read for provenance alongside the
 * human outcome.
 */
export function issueDecision(args: {
  outcome: DecisionOutcome;
  finding: Finding;
  reasonCodes: string[];
  ruleSetVersion: string;
  decidedBy: string;
  decidedAt: string;
}): Decision {
  return {
    outcome: args.outcome,
    finding: args.finding,
    reasonCodes: args.outcome === 'approve-with-conditions' ? [] : [...new Set(args.reasonCodes)],
    ruleSetVersion: args.ruleSetVersion,
    decidedBy: args.decidedBy,
    decidedAt: args.decidedAt,
  };
}
