/**
 * Phase S3 — borrower 1003 application wizard (backlog #381, exercise app A / #317).
 *
 * The big UI slice: a multi-step, resumable wizard mirroring the URLA / Form 1003 sections, built
 * platform-first on the Web Everything **stepper** block (`StepperBehavior`, #053) for the linear
 * locked-progression flow. Each section is a `[data-step]` panel; the stepper shows one at a time and
 * gates advancing past an invalid step via its `canAdvance` hook.
 *
 * Validation is two-layered, honouring the **validation** intent's contract (#-draft): the per-control
 * floor is the native platform (constraint validation — `required`/`type`/`pattern` + `checkValidity()` +
 * `aria-invalid`, the `validation` intent's native substrate), and the cross-field / conditional rules the
 * native API can't express (address history ≥ 24mo, down-payment ≤ price, self-employment income, a "yes"
 * declaration needs an explanation) are a `context: form` validator layered on top. Because the validation
 * **and** input intents ship no active runtime block yet (both `draft` — the WE work this phase drives),
 * those cross-field rules + field rendering are hand-rolled against the intent contract and tagged as GAPs
 * in `conformance.json` (platform-first discipline: consume the contract, flag the missing runtime).
 *
 * Repeating sections (employment, assets, liabilities) support add/remove. On `flow-complete` the wizard
 * assembles a `draft`-state {@link Application} from the collected state and hands it to `onComplete`.
 */
import { StepperBehavior } from '../../../blocks/stepper/StepperBehavior';
import type {
  Application,
  Borrower,
  Employment,
  Asset,
  Liability,
  Address,
  Declaration,
} from '../domain/types';

// ── Validation contract (the `validation` intent's vocabulary, hand-rolled — GAP, no runtime block) ──

/** A single message; `level` is the validation intent's severity vocabulary (error blocks advance). */
export interface ValidationMessage {
  field: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Mutable working state — a partial 1003 the steps read/write; assembled into an Application at the end. */
export interface WizardState {
  loan: {
    purpose: 'purchase' | 'refinance';
    loanAmount: number;
    purchasePrice: number;
    downPayment: number;
    propertyState: string;
  };
  borrower: {
    firstName: string;
    lastName: string;
    email: string;
    ssnLast4: string;
    maritalStatus: 'married' | 'unmarried' | 'separated';
    addresses: Array<Pick<Address, 'street' | 'city' | 'state' | 'zip' | 'monthsAtAddress'>>;
  };
  employment: Array<Pick<Employment, 'employerName' | 'position' | 'monthsOnJob' | 'selfEmployed'> & {
    monthlyIncome: number;
  }>;
  assets: Array<{ institution: string; balance: number }>;
  liabilities: Array<{ creditor: string; monthlyPayment: number }>;
  declarations: Declaration[];
  demographic: { declinedToProvide: boolean; sex?: string };
}

/** A fresh, minimal working state — one address, one employment, the standard 1003 declarations. */
export function initialWizardState(): WizardState {
  return {
    loan: { purpose: 'purchase', loanAmount: 0, purchasePrice: 0, downPayment: 0, propertyState: '' },
    borrower: {
      firstName: '',
      lastName: '',
      email: '',
      ssnLast4: '',
      maritalStatus: 'unmarried',
      addresses: [{ street: '', city: '', state: '', zip: '', monthsAtAddress: 0 }],
    },
    employment: [{ employerName: '', position: '', monthsOnJob: 0, selfEmployed: false, monthlyIncome: 0 }],
    assets: [{ institution: '', balance: 0 }],
    liabilities: [],
    declarations: DECLARATION_QUESTIONS.map((q) => ({ ...q, answer: false })),
    demographic: { declinedToProvide: false },
  };
}

const DECLARATION_QUESTIONS: ReadonlyArray<Pick<Declaration, 'code' | 'question'>> = [
  { code: 'A', question: 'Are there outstanding judgments against you?' },
  { code: 'B', question: 'Have you declared bankruptcy within the past 7 years?' },
  { code: 'C', question: 'Do you own other real estate?' },
];

// ── Cross-field / conditional validators (the part native constraint validation can't express) ──
// Pure functions over the working state, so they are unit-testable independent of the DOM. Each returns
// the `context: form` messages for one step; an `error` blocks the stepper from advancing.

export const STEP_IDS = [
  'loan',
  'borrower',
  'employment',
  'finances',
  'declarations',
  'demographic',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export function validateStep(step: StepId, s: WizardState): ValidationMessage[] {
  switch (step) {
    case 'loan':
      return validateLoan(s);
    case 'borrower':
      return validateBorrower(s);
    case 'employment':
      return validateEmployment(s);
    case 'finances':
      return validateFinances(s);
    case 'declarations':
      return validateDeclarations(s);
    case 'demographic':
      return [];
    default:
      return [];
  }
}

function validateLoan(s: WizardState): ValidationMessage[] {
  const m: ValidationMessage[] = [];
  if (s.loan.loanAmount <= 0) m.push({ field: 'loanAmount', level: 'error', message: 'Loan amount is required.' });
  if (s.loan.purpose === 'purchase') {
    if (s.loan.purchasePrice <= 0) {
      m.push({ field: 'purchasePrice', level: 'error', message: 'Purchase price is required for a purchase.' });
    }
    if (s.loan.downPayment > s.loan.purchasePrice) {
      m.push({ field: 'downPayment', level: 'error', message: 'Down payment cannot exceed the purchase price.' });
    }
    // Cross-field: financed amount should not exceed price − down payment.
    if (s.loan.purchasePrice > 0 && s.loan.loanAmount > s.loan.purchasePrice - s.loan.downPayment) {
      m.push({
        field: 'loanAmount',
        level: 'warning',
        message: 'Loan amount exceeds price minus down payment — verify the financing.',
      });
    }
  }
  return m;
}

function validateBorrower(s: WizardState): ValidationMessage[] {
  const m: ValidationMessage[] = [];
  if (!s.borrower.firstName.trim() || !s.borrower.lastName.trim()) {
    m.push({ field: 'name', level: 'error', message: 'Borrower first and last name are required.' });
  }
  if (!/^\d{4}$/.test(s.borrower.ssnLast4)) {
    m.push({ field: 'ssnLast4', level: 'error', message: 'Enter the last 4 digits of the SSN.' });
  }
  // Cross-field/aggregate: URLA requires ≥ 24 months of address history.
  const months = s.borrower.addresses.reduce((t, a) => t + (Number(a.monthsAtAddress) || 0), 0);
  if (months < 24) {
    m.push({
      field: 'addresses',
      level: 'error',
      message: `Address history must cover at least 24 months (currently ${months}). Add a former address.`,
    });
  }
  return m;
}

function validateEmployment(s: WizardState): ValidationMessage[] {
  const m: ValidationMessage[] = [];
  if (s.employment.length === 0) {
    m.push({ field: 'employment', level: 'error', message: 'At least one employment entry is required.' });
  }
  const totalIncome = s.employment.reduce((t, e) => t + (Number(e.monthlyIncome) || 0), 0);
  if (totalIncome <= 0) {
    m.push({ field: 'income', level: 'error', message: 'Total monthly income must be greater than zero.' });
  }
  // Conditional: a self-employed entry needs income recorded (it drives self-employment doc requirements).
  for (const [i, e] of s.employment.entries()) {
    if (e.selfEmployed && (Number(e.monthlyIncome) || 0) <= 0) {
      m.push({
        field: `employment.${i}.monthlyIncome`,
        level: 'error',
        message: `Self-employed entry "${e.employerName || `#${i + 1}`}" needs monthly income.`,
      });
    }
  }
  return m;
}

function validateFinances(s: WizardState): ValidationMessage[] {
  const m: ValidationMessage[] = [];
  const totalAssets = s.assets.reduce((t, a) => t + (Number(a.balance) || 0), 0);
  // Cross-section: need enough liquid assets to cover the down payment.
  if (s.loan.purpose === 'purchase' && totalAssets < s.loan.downPayment) {
    m.push({
      field: 'assets',
      level: 'error',
      message: `Assets (${totalAssets}) must cover the down payment (${s.loan.downPayment}).`,
    });
  }
  return m;
}

function validateDeclarations(s: WizardState): ValidationMessage[] {
  // Conditional: any "yes" declaration requires an explanation.
  return s.declarations
    .filter((d) => d.answer && !d.explanation?.trim())
    .map((d) => ({
      field: `declaration.${d.code}`,
      level: 'error' as const,
      message: `Declaration ${d.code} answered "yes" — an explanation is required.`,
    }));
}

/** Does the borrower's declaration set indicate they own other real estate (drives the REO follow-up)? */
export function ownsOtherRealEstate(s: WizardState): boolean {
  return s.declarations.some((d) => d.code === 'C' && d.answer);
}

// ── Assemble the collected state into a draft Application ──────────────────────────────────────────

/** Build a `draft`-state {@link Application} from the completed wizard state. */
export function buildDraftApplication(s: WizardState, now: Date): Application {
  const borrower: Borrower = {
    id: 'b1',
    isPrimary: true,
    firstName: s.borrower.firstName,
    lastName: s.borrower.lastName,
    ssnLast4: s.borrower.ssnLast4,
    email: s.borrower.email,
    phone: '',
    maritalStatus: s.borrower.maritalStatus,
    dependents: 0,
    creditScore: 0,
    addresses: s.borrower.addresses.map((a, i) => ({ ...a, kind: i === 0 ? 'current' : 'former' })),
    employment: s.employment.map((e) => ({
      employerName: e.employerName,
      position: e.position,
      monthsOnJob: e.monthsOnJob,
      selfEmployed: e.selfEmployed,
      income: [{ kind: e.selfEmployed ? 'self-employment' : 'base', monthlyAmount: e.monthlyIncome }],
    })),
    declarations: s.declarations,
    demographic: { declinedToProvide: s.demographic.declinedToProvide, sex: s.demographic.sex },
  };
  const iso = now.toISOString();
  return {
    id: `app-${iso}`,
    loanNumber: `LN-DRAFT-${iso.slice(0, 10)}`,
    state: 'draft',
    createdAt: iso,
    updatedAt: iso,
    loanOfficerId: 'lo1',
    borrowers: [borrower],
    property: {
      address: { street: '', city: '', state: s.loan.propertyState, zip: '', monthsAtAddress: 0, kind: 'mailing' },
      type: 'single-family',
      occupancy: 'primary',
      estimatedValue: s.loan.purchasePrice,
      purchasePrice: s.loan.purpose === 'purchase' ? s.loan.purchasePrice : undefined,
    },
    loan: {
      purpose: s.loan.purpose,
      productId: '',
      loanAmount: s.loan.loanAmount,
      termMonths: 360,
      noteRate: 0,
      lockDays: 30,
      downPayment: s.loan.downPayment,
    },
    assets: s.assets.map((a) => ({ kind: 'checking', institution: a.institution, balance: a.balance, liquid: true })),
    liabilities: s.liabilities.map((l) => ({
      kind: 'revolving',
      creditor: l.creditor,
      monthlyPayment: l.monthlyPayment,
      balance: 0,
      paidOffAtClosing: false,
    })),
    realEstateOwned: [],
    documents: [],
    conditions: [],
    disclosures: [],
    audit: [],
  };
}
