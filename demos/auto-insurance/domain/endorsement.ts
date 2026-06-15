/**
 * Phase S5 — endorsements (mid-term change), backlog #416.
 *
 * The pure domain core of the endorsement flow: apply a mid-term change to an in-force policy
 * (add/remove a coverage or driver, change the garaging territory), RE-RATE the remaining term and
 * PRORATE the premium difference over the unexpired days, and produce an immutable Endorsement record.
 *
 * Reuses shipping standards at the app layer: re-rating is the same Rating engine (#411), the record is
 * appended to the Web Audit trail, and the endorsement is a sub-flow on the in-force policy (the policy
 * STATE is unchanged — Web Lifecycle owns the state machine; an endorsement is a within-state change).
 * Authorization is role-gated (agent / underwriter) as a stand-in for Web Guards (PLATFORM-GAP: #289);
 * re-issued documents are app-generated artifacts (PLATFORM-GAP: #028).
 */

import type { Policy, Role, Coverage, Driver, Endorsement, EndorsementChange, EndorsementChangeId } from './types';
import { rate } from './rating';
import { issuePolicyDocuments } from './binding';

/** Only an agent or underwriter may endorse a policy. */
const ENDORSER_ROLES: Role[] = ['agent', 'underwriter'];
export const canEndorse = (role: Role): boolean => ENDORSER_ROLES.includes(role);

const DAY = 86_400_000;
const TERRITORY_ORDER = ['T1', 'T2', 'T3', 'T4', 'T5'];

const hasCov = (p: Policy, id: Coverage['id']): boolean => p.coverages.some((c) => c.id === id);

/** A change the developer can pick — applicability gates which appear for the current policy. */
interface ChangeDef {
  id: EndorsementChangeId;
  label: string;
  applicable(p: Policy): boolean;
  describe(p: Policy): string;
  apply(p: Policy): void;
}

/** A representative additional driver an "add driver" endorsement introduces (re-rates the policy up). */
const ADDED_DRIVER: Driver = { firstName: 'Added', lastName: 'Driver', licenseYears: 2, incidents: 1 };

const CHANGES: ChangeDef[] = [
  {
    id: 'add-collision',
    label: 'Add Collision coverage',
    applicable: (p) => !hasCov(p, 'collision'),
    describe: () => 'Added Collision coverage',
    apply: (p) => { p.coverages.push({ id: 'collision', deductible: 500 }); },
  },
  {
    id: 'remove-collision',
    label: 'Remove Collision coverage',
    applicable: (p) => hasCov(p, 'collision'),
    describe: () => 'Removed Collision coverage',
    apply: (p) => { p.coverages = p.coverages.filter((c) => c.id !== 'collision'); },
  },
  {
    id: 'add-comprehensive',
    label: 'Add Comprehensive coverage',
    applicable: (p) => !hasCov(p, 'comprehensive'),
    describe: () => 'Added Comprehensive coverage',
    apply: (p) => { p.coverages.push({ id: 'comprehensive', deductible: 250 }); },
  },
  {
    id: 'remove-comprehensive',
    label: 'Remove Comprehensive coverage',
    applicable: (p) => hasCov(p, 'comprehensive'),
    describe: () => 'Removed Comprehensive coverage',
    apply: (p) => { p.coverages = p.coverages.filter((c) => c.id !== 'comprehensive'); },
  },
  {
    id: 'move-territory',
    label: 'Change garaging address (next territory)',
    applicable: (p) => TERRITORY_ORDER.indexOf(p.territory) < TERRITORY_ORDER.length - 1,
    describe: (p) => `Moved garaging territory ${p.territory} → ${nextTerritory(p.territory)}`,
    apply: (p) => { p.territory = nextTerritory(p.territory); },
  },
  {
    id: 'add-driver',
    label: 'Add a driver',
    applicable: () => true,
    describe: () => `Added driver ${ADDED_DRIVER.firstName} ${ADDED_DRIVER.lastName}`,
    apply: (p) => { p.drivers.push({ ...ADDED_DRIVER }); },
  },
  {
    id: 'remove-driver',
    label: 'Remove the most recently added driver',
    applicable: (p) => p.drivers.length > 1,
    describe: (p) => `Removed driver ${p.drivers[p.drivers.length - 1].firstName} ${p.drivers[p.drivers.length - 1].lastName}`,
    apply: (p) => { p.drivers = p.drivers.slice(0, -1); },
  },
];

const nextTerritory = (t: string): string => {
  const i = TERRITORY_ORDER.indexOf(t);
  return i >= 0 && i < TERRITORY_ORDER.length - 1 ? TERRITORY_ORDER[i + 1] : t;
};
const changeDef = (id: EndorsementChangeId): ChangeDef | undefined => CHANGES.find((c) => c.id === id);

/** The changes offered for the current in-force policy. */
export function availableEndorsements(p: Policy): EndorsementChange[] {
  return CHANGES.filter((c) => c.applicable(p)).map((c) => ({ id: c.id, label: c.label }));
}

/** The unexpired share of the term the prorated delta is charged over (clamped to [0,1]). */
export function remainingFraction(p: Policy, effectiveIso: string): number {
  const start = new Date(p.term.start).getTime();
  const end = new Date(p.term.start);
  end.setUTCMonth(end.getUTCMonth() + p.term.months);
  const endMs = end.getTime();
  const eff = Math.min(Math.max(new Date(effectiveIso).getTime(), start), endMs);
  const total = Math.max(endMs - start, DAY);
  return Math.max(0, Math.min(1, (endMs - eff) / total));
}

/**
 * Preview an endorsement WITHOUT mutating the policy: re-rate a clone with the change applied and
 * prorate the 6-month premium difference over the unexpired term.
 */
export function previewEndorsement(p: Policy, changeId: EndorsementChangeId, effectiveIso: string): Omit<Endorsement, 'endorsementNumber' | 'at' | 'actor'> {
  const def = changeDef(changeId);
  if (!def) throw new Error(`Unknown endorsement change: ${changeId}`);
  const oldPremium = rate(p).premium;
  const after: Policy = structuredClone(p);
  def.apply(after);
  const rerated = rate(after);
  const frac = remainingFraction(p, effectiveIso);
  const proratedDelta = Math.round((rerated.premium - oldPremium) * frac);
  return {
    policyNumber: p.policyNumber,
    changeId,
    description: def.describe(p),
    effective: effectiveIso,
    oldPremium,
    newPremium: rerated.premium,
    proratedDelta,
    remainingFraction: frac,
    finding: rerated.finding,
  };
}

/**
 * Apply an endorsement: mutate the policy, append the immutable Endorsement record + an audit entry, and
 * RE-ISSUE the documents so the declarations page + ID cards reflect the change. The policy STATE is
 * unchanged (it stays in-force). Returns the recorded Endorsement.
 */
export function applyEndorsement(p: Policy, changeId: EndorsementChangeId, at: string, actor: Role): Endorsement {
  if (!canEndorse(actor)) throw new Error(`Role "${actor}" may not endorse a policy`);
  const def = changeDef(changeId);
  if (!def) throw new Error(`Unknown endorsement change: ${changeId}`);

  const preview = previewEndorsement(p, changeId, at);
  def.apply(p); // mutate the live policy

  const seq = (p.endorsements?.length ?? 0) + 1;
  const endorsement: Endorsement = {
    ...preview,
    endorsementNumber: `${p.policyNumber}-E${String(seq).padStart(2, '0')}`,
    at,
    actor,
  };
  (p.endorsements ??= []).push(endorsement);
  p.audit.push({
    at,
    actor,
    action: `endorsement.applied — ${endorsement.endorsementNumber}: ${endorsement.description} (${endorsement.proratedDelta >= 0 ? '+' : ''}${endorsement.proratedDelta} prorated)`,
  });

  // Re-issue the documents so the declarations page + ID cards reflect the change.
  p.issued = undefined;
  issuePolicyDocuments(p, preview.newPremium, at);

  return endorsement;
}
