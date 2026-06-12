/**
 * Loan-origination domain model — entity types.
 *
 * Exercise app A (backlog #317). The shape mirrors the URLA / Fannie Mae Form 1003
 * section model and an AUS-style decisioning loop; it is approximated, not a compliant LOS.
 * See reports/2026-06-11-exercise-app-loan-origination-requirements.md.
 */

// ---------------------------------------------------------------------------
// Roles, lifecycle, shared enums
// ---------------------------------------------------------------------------

export type Role = 'borrower' | 'loan-officer' | 'processor' | 'underwriter' | 'admin';

/** Application lifecycle states (see the state machine in lifecycle.ts). */
export type ApplicationState =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'underwriting'
  | 'approved-with-conditions'
  | 'suspended'
  | 'clear-to-close'
  | 'declined'
  | 'withdrawn';

export const TERMINAL_STATES: ApplicationState[] = ['clear-to-close', 'declined', 'withdrawn'];

export type LoanPurpose = 'purchase' | 'refinance';
export type Occupancy = 'primary' | 'second-home' | 'investment';
export type PropertyType = 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'manufactured';

// ---------------------------------------------------------------------------
// 1003 sub-entities
// ---------------------------------------------------------------------------

export interface Address {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  /** Months the borrower has lived here; address history must cover >= 24 months. */
  monthsAtAddress: number;
  kind: 'current' | 'former' | 'mailing';
}

export type IncomeKind = 'base' | 'overtime' | 'bonus' | 'commission' | 'self-employment' | 'other';

export interface IncomeItem {
  kind: IncomeKind;
  monthlyAmount: number;
}

export interface Employment {
  employerName: string;
  position: string;
  monthsOnJob: number;
  selfEmployed: boolean;
  income: IncomeItem[];
}

export type AssetKind = 'checking' | 'savings' | 'investment' | 'retirement' | 'gift';

export interface Asset {
  kind: AssetKind;
  institution: string;
  balance: number;
  /** Liquid assets count toward reserves & down payment; retirement is partially liquid. */
  liquid: boolean;
}

export type LiabilityKind = 'revolving' | 'installment' | 'mortgage' | 'lease' | 'other';

export interface Liability {
  kind: LiabilityKind;
  creditor: string;
  monthlyPayment: number;
  balance: number;
  /** Paid off at or before closing -> excluded from back-end DTI. */
  paidOffAtClosing: boolean;
}

export interface RealEstateOwned {
  address: string;
  marketValue: number;
  mortgageBalance: number;
  monthlyHousingExpense: number;
  grossRentalIncome: number;
}

/** Yes/no legal declarations; a `true` requires an explanation. */
export interface Declaration {
  code: string;
  question: string;
  answer: boolean;
  explanation?: string;
}

/** Optional HMDA self-identification — collected for fair-lending monitoring, never an engine input. */
export interface Demographic {
  ethnicity?: string[];
  race?: string[];
  sex?: string;
  declinedToProvide: boolean;
}

export interface Borrower {
  id: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  /** Stored masked in UI; full value lives behind the permission wall. */
  ssnLast4: string;
  email: string;
  phone: string;
  maritalStatus: 'married' | 'unmarried' | 'separated';
  dependents: number;
  creditScore: number;
  addresses: Address[];
  employment: Employment[];
  declarations: Declaration[];
  demographic: Demographic;
}

export interface Property {
  address: Address;
  type: PropertyType;
  occupancy: Occupancy;
  estimatedValue: number;
  /** Present for purchases. */
  purchasePrice?: number;
}

export interface LoanRequest {
  purpose: LoanPurpose;
  productId: string;
  loanAmount: number;
  /** Term in months (e.g. 360, 180). */
  termMonths: number;
  /** Note rate as a decimal, e.g. 0.0675. Derived from the rate sheet at selection time. */
  noteRate: number;
  lockDays: 30 | 45 | 60;
  downPayment: number;
}

// ---------------------------------------------------------------------------
// Documents, conditions, decision, audit
// ---------------------------------------------------------------------------

export type DocumentState = 'requested' | 'uploaded' | 'accepted' | 'rejected';

export interface LoanDocument {
  id: string;
  /** e.g. 'paystub', 'w2', 'bank-statement', 'purchase-agreement', 'business-returns'. */
  type: string;
  label: string;
  state: DocumentState;
  blocking: boolean;
  rejectionReason?: string;
  fileNames: string[];
}

export type ConditionType = 'PTA' | 'PTD' | 'PTF';
export type ConditionStatus = 'open' | 'submitted' | 'cleared' | 'waived';

export interface Condition {
  id: string;
  type: ConditionType;
  description: string;
  assignedTo: Role;
  status: ConditionStatus;
}

export type Finding = 'approve-eligible' | 'refer' | 'refer-with-caution' | 'ineligible';
export type DecisionOutcome = 'approve-with-conditions' | 'suspend' | 'decline';

export interface Decision {
  outcome: DecisionOutcome;
  finding: Finding;
  /** Adverse-action / reason codes (ECOA-style) when suspended or declined. */
  reasonCodes: string[];
  /** The rule-catalog version this decision was evaluated against (reproducibility). */
  ruleSetVersion: string;
  decidedBy: string;
  decidedAt: string;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface Disclosure {
  type: 'loan-estimate' | 'initial-package' | 'redisclosure';
  generatedAt: string;
  /** TRID-style: borrower owed the disclosure within this many business days of application. */
  dueWithinBusinessDays: number;
  signedAt?: string;
  signedBy?: string;
}

// ---------------------------------------------------------------------------
// Root aggregate
// ---------------------------------------------------------------------------

export interface Application {
  id: string;
  /** Human-friendly loan number, e.g. "LN-2026-004217". */
  loanNumber: string;
  state: ApplicationState;
  createdAt: string;
  updatedAt: string;
  /** Owning loan officer (pipeline scoping); borrowers own the draft until submit. */
  loanOfficerId: string;
  assignedProcessorId?: string;
  assignedUnderwriterId?: string;

  borrowers: Borrower[];
  property: Property;
  loan: LoanRequest;
  assets: Asset[];
  liabilities: Liability[];
  realEstateOwned: RealEstateOwned[];

  documents: LoanDocument[];
  conditions: Condition[];
  disclosures: Disclosure[];
  decision?: Decision;
  audit: AuditEvent[];
}
