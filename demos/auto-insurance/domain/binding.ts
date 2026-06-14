/**
 * Phase S4 — bind, issue & payment (backlog #415).
 *
 * The pure domain core of the bind/issue flow: collect the premium, expose the payment-received guard
 * predicate the Web Lifecycle GuardResolver consults to allow `quoted → bound`, and generate the
 * issuance artifacts (a declarations page + an ID card per vehicle) at `bound → in-force`.
 *
 * Reuses shipping standards at the app layer: the guarded transitions are Web Lifecycle, every step is
 * auto-audited via Web Audit, and the state chips are Status Indicator. The guarded-transition seam
 * itself is delegated to the in-app lifecycle GuardResolver as a stand-in for Web Guards (PLATFORM-GAP:
 * #289), and the issued documents are app-generated artifacts — the richer file-handling block is
 * uncodified (PLATFORM-GAP: #028).
 */

import type { Policy, PaymentMethod, PremiumPayment, IssuedDocuments, IdCard } from './types';

/** Collect the premium on a quoted policy — stamps the payment record the bind guard then reads. */
export function collectPayment(policy: Policy, method: PaymentMethod, amount: number, at: string): PremiumPayment {
  const payment: PremiumPayment = {
    method,
    amount,
    collectedAt: at,
    reference: `PMT-${policy.policyNumber}-${at.slice(0, 10).replace(/-/g, '')}`,
  };
  policy.payment = payment;
  return payment;
}

/** The `payment-received` guard predicate — true once the premium has been collected. */
export function paymentReceived(policy: Policy | undefined): boolean {
  return !!policy?.payment;
}

const addMonths = (iso: string, months: number): string => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** A deterministic mock 17-char VIN for the ID card — demo data, not a real VIN check-digit. */
const mockVin = (policyNumber: string, year: number, make: string, i: number): string => {
  const raw = `${make}${year}${policyNumber}${i}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (raw + '00000000000000000').slice(0, 17);
};

/**
 * Generate issuance artifacts at bind→in-force: a mock declarations page summarising the bound policy
 * plus one ID card per insured vehicle. Idempotent — re-issuing returns the existing documents.
 */
export function issuePolicyDocuments(policy: Policy, premium: number, at: string): IssuedDocuments {
  if (policy.issued) return policy.issued;
  const effective = policy.term.start;
  const expires = addMonths(policy.term.start, policy.term.months);
  const idCards: IdCard[] = policy.vehicles.map((v, i) => ({
    vehicle: `${v.year} ${v.make} ${v.model}`,
    vin: mockVin(policy.policyNumber, v.year, v.make, i),
    policyNumber: policy.policyNumber,
    effective: shortDate(effective),
    expires: shortDate(expires),
  }));
  const insured = `${policy.insured.firstName} ${policy.insured.lastName}`;
  const coverages = policy.coverages.map((c) => c.id).join(', ');
  const declarationsPage = [
    `AUTO POLICY DECLARATIONS — ${policy.policyNumber}`,
    `Named insured: ${insured}`,
    `Term: ${shortDate(effective)} – ${shortDate(expires)} (${policy.term.months} months)`,
    `Vehicles: ${idCards.map((c) => c.vehicle).join('; ')}`,
    `Coverages: ${coverages}`,
    `6-month premium: $${premium.toLocaleString()}`,
  ].join('\n');
  policy.issued = { policyNumber: policy.policyNumber, declarationsPage, idCards, issuedAt: at };
  return policy.issued;
}
