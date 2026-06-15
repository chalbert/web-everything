/**
 * Adjuster workbench domain (S8, #419) — the claim-adjustment decision layer on top of the S7 claim
 * lifecycle. Insurance is the SECOND consumer of the Web Decisions decision-trace standard (the loan app
 * drove it, the UW workbench already renders one for the policy); here the adjuster's approve/deny is
 * emitted as the same normalized {@link DecisionRecord}, so a reason-coded claim decision renders through
 * the unchanged decision-trace block — a cross-surface conformance check of the standard.
 *
 * Pure domain: no DOM. The app wires these builders into the claim detail panel.
 */

import type { Claim, ClaimDocCheck, LossType } from './types';
import type { DecisionRecord } from '../../../blocks/renderers/decision-trace/renderDecisionTrace';

/** The reason an adjuster can cite when approving a claim (→ the decision record's reasonCodes). */
export const APPROVE_REASONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'coverage-confirmed', label: 'Coverage confirmed' },
  { code: 'liability-accepted', label: 'Liability accepted' },
  { code: 'docs-complete', label: 'Documentation complete' },
];

/** The reason an adjuster can cite when denying a claim. */
export const DENY_REASONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'not-covered', label: 'Loss not covered' },
  { code: 'policy-not-in-force', label: 'Policy not in force at loss' },
  { code: 'insufficient-documentation', label: 'Insufficient documentation' },
  { code: 'suspected-fraud', label: 'Suspected fraud — refer to SIU' },
];

/** The required-document checklist for a loss type — the adjuster confirms each before approval. */
const REQUIRED_DOCS: Record<LossType, ReadonlyArray<{ id: string; label: string }>> = {
  collision: [
    { id: 'police-report', label: 'Police report' },
    { id: 'photos', label: 'Damage photos' },
    { id: 'repair-estimate', label: 'Repair estimate' },
  ],
  comprehensive: [
    { id: 'photos', label: 'Damage photos' },
    { id: 'repair-estimate', label: 'Repair estimate' },
  ],
  liability: [
    { id: 'police-report', label: 'Police report' },
    { id: 'photos', label: 'Scene photos' },
    { id: 'witness-statement', label: 'Witness statement' },
  ],
  theft: [
    { id: 'police-report', label: 'Police report' },
    { id: 'proof-of-ownership', label: 'Proof of ownership' },
  ],
  glass: [
    { id: 'photos', label: 'Damage photos' },
    { id: 'repair-estimate', label: 'Repair estimate' },
  ],
};

/**
 * Build the checklist for a claim, seeding `received` from any FNOL attachments already on file (a photo
 * attachment satisfies the `photos` line). Idempotent: an existing checklist is returned untouched.
 */
export function buildChecklist(claim: Claim): ClaimDocCheck[] {
  if (claim.checklist) return claim.checklist;
  const hasPhoto = claim.documents.some((d) => /\.(jpg|jpeg|png|heic)$/i.test(d));
  return REQUIRED_DOCS[claim.lossType].map((d) => ({
    ...d,
    received: d.id === 'photos' ? hasPhoto : false,
  }));
}

/** True when every required document is checked off — the gate the approve decision records. */
export function docsComplete(claim: Claim): boolean {
  return buildChecklist(claim).every((d) => d.received);
}

/**
 * Normalize a claim approve/deny into the Web Decisions {@link DecisionRecord} — the same contract the UW
 * workbench emits, so it renders through the unchanged decision-trace block. The criteria are the
 * adjuster's actual gates: coverage applies, documentation complete, a reserve is set.
 */
export function claimDecisionRecord(
  claim: Claim,
  outcome: 'approved' | 'denied',
  reasonCode: string,
  at: string,
): DecisionRecord {
  const checklist = buildChecklist(claim);
  const received = checklist.filter((d) => d.received).length;
  const complete = received === checklist.length;
  const reserveSet = claim.reserve > 0;
  return {
    subject: { type: 'claim', id: claim.claimNumber },
    ruleSet: { id: 'claim-adjustment', version: '2026.06.0' },
    outcome,
    reasonCodes: [reasonCode],
    at,
    criteria: [
      {
        id: 'coverage-applies',
        label: 'Loss type is a covered peril',
        input: { name: 'lossType', value: claim.lossType },
        operator: 'in',
        threshold: 'covered perils',
        outcome: outcome === 'denied' && reasonCode === 'not-covered' ? 'fail' : 'pass',
        reasonCode: reasonCode === 'not-covered' ? 'not-covered' : undefined,
      },
      {
        id: 'docs-complete',
        label: 'Required documentation received',
        input: { name: 'documents', value: `${received}/${checklist.length}` },
        operator: '=',
        threshold: `${checklist.length}/${checklist.length}`,
        outcome: complete ? 'pass' : 'fail',
        reasonCode: complete ? undefined : 'insufficient-documentation',
      },
      {
        id: 'reserve-set',
        label: 'Loss reserve established',
        input: { name: 'reserve', value: claim.reserve },
        operator: '>',
        threshold: 0,
        outcome: reserveSet ? 'pass' : 'fail',
      },
    ],
  };
}
