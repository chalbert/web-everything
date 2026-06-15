/** Personal-auto domain types (exercise app B, #318). Approximated, not a compliant rating plan. */

export type Role = 'policyholder' | 'agent' | 'underwriter' | 'adjuster';

/** Policy lifecycle states (Web Lifecycle). */
export type PolicyState =
  | 'quote'
  | 'referred'
  | 'quoted'
  | 'bound'
  | 'in-force'
  | 'cancelled'
  | 'expired'
  | 'lapsed';

export const POLICY_TERMINAL: PolicyState[] = ['cancelled', 'expired'];

/** Claim sub-lifecycle (a second entity machine on the same app). */
export type ClaimState =
  | 'fnol'
  | 'triage'
  | 'investigating'
  | 'approved'
  | 'paying'
  | 'paid'
  | 'denied'
  | 'closed';

/** Underwriting outcome / tier. */
export type UwFinding = 'preferred' | 'accept' | 'refer' | 'decline';

export type CoverageId =
  | 'bi' | 'pd' | 'pip' | 'um' | 'collision' | 'comprehensive' | 'rental' | 'roadside';

export type Op = 'lte' | 'gte' | 'lt' | 'gt' | 'eq' | 'isFalse';
export type RuleOutcome = 'pass' | 'refer' | 'fail';

export interface Driver {
  firstName: string;
  lastName: string;
  licenseYears: number;
  incidents: number; // at-fault accidents + major violations, last 5y
}

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  symbol: number;     // ISO-style rating symbol (1–27)
  annualMiles: number;
  value: number;
}

export interface Coverage {
  id: CoverageId;
  limit?: number;
  deductible?: number;
}

/** One rating factor's contribution (the premium breakdown — distinct from the UW decision trace). */
export interface RatingFactor {
  id: string;
  label: string;
  input: string | number;
  basis: string;
  multiplier: number;
}

/** One underwriting criterion result — the decision-trace shape (mirrors the loan app's RuleResult). */
export interface UwCriterion {
  ruleId: string;
  label: string;
  factName: string;
  factValue: number;
  op: Op;
  thresholdValue: number;
  outcome: RuleOutcome;
  reasonCode?: string;
}

export interface RatingResult {
  base: number;
  factors: RatingFactor[];
  premium: number;        // 6-month term premium
  finding: UwFinding;
  trace: UwCriterion[];   // the underwriting decision trace (→ DecisionRecord)
  reasonCodes: string[];
  ruleSetVersion: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
}

// ── Binding, payment & issuance (S4, #415) ──────────────────────────────────────────
export type PaymentMethod = 'card' | 'ach' | 'check';

export interface PremiumPayment {
  method: PaymentMethod;
  amount: number;
  collectedAt: string; // ISO
  reference: string;   // mock confirmation/auth number
}

/** A mock auto ID card — one per insured vehicle on an issued policy. */
export interface IdCard {
  vehicle: string; // "2021 Toyota Camry"
  vin: string;
  policyNumber: string;
  effective: string;
  expires: string;
}

/** The artifacts produced at issuance: a declarations page + an ID card per vehicle (mock). */
export interface IssuedDocuments {
  policyNumber: string;
  declarationsPage: string; // mock declarations-page body text
  idCards: IdCard[];
  issuedAt: string;
}

export type LossType = 'collision' | 'comprehensive' | 'liability' | 'theft' | 'glass';

export interface Claim {
  claimNumber: string;
  policyNumber: string;
  state: ClaimState;
  lossType: LossType;
  lossDate: string;
  description: string;
  reserve: number;
  documents: string[]; // file names (FNOL attachments)
  audit: AuditEntry[];
}

// ── Endorsements (S5, #416) — mid-term change + prorated re-rate ─────────────────
/** The mid-term changes an in-force policy can take (add/remove vehicle or driver, change coverage or address). */
export type EndorsementChangeId =
  | 'add-collision' | 'remove-collision'
  | 'add-comprehensive' | 'remove-comprehensive'
  | 'move-territory'
  | 'add-driver' | 'remove-driver';

/** An applicable change offered for the current policy (drives the endorsement picker). */
export interface EndorsementChange {
  id: EndorsementChangeId;
  label: string;
}

/** The immutable record produced by an endorsement — the audited deliverable. */
export interface Endorsement {
  endorsementNumber: string;
  policyNumber: string;
  changeId: EndorsementChangeId;
  description: string;
  effective: string;        // ISO — the mid-term effective date
  oldPremium: number;       // 6-month term premium before the change
  newPremium: number;       // 6-month term premium after the change
  proratedDelta: number;    // charge (+) or credit (−) for the unexpired term only
  remainingFraction: number; // unexpired share of the term the delta is prorated over
  finding: UwFinding;       // re-rated UW finding (a coverage/driver change can re-tier)
  at: string;
  actor: string;
}

// ── Renewals & cancellation (S6, #417) ──────────────────────────────────────────
/** Why a policy is cancelled — drives the cancel-reason guard + the proration basis. */
export type CancellationReason = 'non-pay' | 'insured-request' | 'underwriting';

/** A recorded cancellation — the cancel-reason guard input + the prorated refund. */
export interface Cancellation {
  reason: CancellationReason;
  effective: string;        // ISO — cancellation effective date
  termPremium: number;      // the 6-month premium the proration is taken from
  earnedFraction: number;   // share of the term elapsed (insurer keeps)
  unearnedRefund: number;   // refund of the unexpired term (0 if short-rate on non-pay)
  at: string;
  actor: string;
}

/** A renewal offer / decision at term end — re-rate carried into the next term. */
export interface Renewal {
  offeredAt: string;
  oldPremium: number;
  newPremium: number;       // re-rated next-term premium
  effective: string;        // next term start (= current term end)
  decision: 'accepted' | 'non-renewed';
  at: string;
  actor: string;
}

export interface Policy {
  policyNumber: string;
  state: PolicyState;
  insured: Driver;        // primary named insured
  drivers: Driver[];
  vehicles: Vehicle[];
  coverages: Coverage[];
  territory: string;      // garaging territory band
  priorLapse: boolean;    // lapse in prior coverage
  term: { start: string; months: number };
  audit: AuditEntry[];
  payment?: PremiumPayment;   // S4 (#415): set when premium is collected — the payment-received guard input
  issued?: IssuedDocuments;   // S4 (#415): set at issuance (bound → in-force)
  endorsements?: Endorsement[]; // S5 (#416): mid-term changes applied in force
  cancellation?: Cancellation;  // S6 (#417): set on cancel — the cancel-reason guard input
  renewals?: Renewal[];         // S6 (#417): renewal offers/decisions at term end
}
