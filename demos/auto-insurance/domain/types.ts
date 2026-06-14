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
}
