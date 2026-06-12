/**
 * Deterministic seed data — generates a synthetic pipeline of applications.
 *
 * Uses a seeded PRNG so the dataset is reproducible (no Math.random). Default size is 5k to stress
 * the pipeline's windowing/pagination (settled decision #4). Applications are spread across lifecycle
 * states, products, and credit/DTI/LTV profiles so the rules engine produces a realistic mix of findings.
 */

import type {
  Application, ApplicationState, Borrower, LoanRequest, Property, Asset, Liability, LoanDocument, Role,
} from './types';
import { PRODUCTS } from './catalog';
import { priceLoan, monthlyPI } from './catalog';

/** mulberry32 — tiny deterministic PRNG. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ava', 'Liam', 'Noah', 'Mia', 'Ethan', 'Sofia', 'Lucas', 'Isla', 'Mason', 'Aria', 'Leo', 'Zoe', 'Owen', 'Maya', 'Kai'];
const LAST = ['Nguyen', 'Patel', 'Garcia', 'Smith', 'Khan', 'Rossi', 'Cohen', 'Okafor', 'Müller', 'Tanaka', 'Silva', 'Haddad', 'Ivanov', 'Reyes', 'Adeyemi'];
const CITIES: Array<[string, string]> = [['Austin', 'TX'], ['Denver', 'CO'], ['Tampa', 'FL'], ['Reno', 'NV'], ['Boise', 'ID'], ['Raleigh', 'NC']];
const STATES: ApplicationState[] = ['draft', 'submitted', 'processing', 'underwriting', 'approved-with-conditions', 'suspended', 'clear-to-close', 'declined', 'withdrawn'];
const LO_IDS = ['lo-amir', 'lo-bea', 'lo-chen', 'lo-dana'];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function int(rng: () => number, lo: number, hi: number): number {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

function makeBorrower(rng: () => number, primary: boolean, score: number, monthlyIncome: number, monthsOnJob: number): Borrower {
  return {
    id: `b-${Math.floor(rng() * 1e9).toString(36)}`,
    isPrimary: primary,
    firstName: pick(rng, FIRST),
    lastName: pick(rng, LAST),
    ssnLast4: String(int(rng, 1000, 9999)),
    email: 'borrower@example.test',
    phone: '555-0100',
    maritalStatus: pick(rng, ['married', 'unmarried', 'separated'] as const),
    dependents: int(rng, 0, 3),
    creditScore: score,
    addresses: [{ street: `${int(rng, 100, 9999)} Main St`, city: 'Austin', state: 'TX', zip: '78701', monthsAtAddress: Math.max(monthsOnJob, 24), kind: 'current' }],
    employment: [{ employerName: 'Acme Co', position: 'Engineer', monthsOnJob, selfEmployed: rng() < 0.15, income: [{ kind: 'base', monthlyAmount: monthlyIncome }] }],
    declarations: [],
    demographic: { declinedToProvide: true },
  };
}

export function generateApplication(seed: number): Application {
  const rng = makeRng(seed);
  const product = pick(rng, PRODUCTS);
  const [city, st] = pick(rng, CITIES);
  const term = product.termMonths[0];

  // --- Calibrated profile so the rules engine produces a realistic finding spread. ---
  // Score: mostly clears the product minimum (slack skewed positive), occasionally below.
  const score = Math.max(560, Math.min(800, product.minScore + int(rng, -12, 150)));

  // LTV: 90% within the product ceiling, 10% over (-> LTV-OVER fails).
  const overLtv = rng() < 0.10;
  const floor = Math.min(0.55, product.maxLTV - 0.05);
  const ltv = overLtv
    ? Math.min(0.99, product.maxLTV + 0.01 + rng() * 0.08)
    : floor + rng() * (product.maxLTV - 0.01 - floor);

  // Derive a consistent loan/value pair from the loan band + ltv.
  const loanAmount = int(rng, product.minLoanAmount, Math.min(product.maxLoanAmount, 1_500_000));
  const value = Math.round(loanAmount / ltv);
  const purpose = rng() < 0.6 ? 'purchase' : 'refinance';
  const downPayment = purpose === 'purchase' ? Math.max(0, value - loanAmount) : 0;

  const quote = priceLoan(product.id, loanAmount, term, score, ltv)!;
  const pi = quote.monthlyPrincipalInterest;
  const taxesInsurance = value * (0.013 / 12);
  const housing = pi + taxesInsurance;

  // Back-solve gross income from a realistic target back-end DTI (0.20..0.58).
  const otherDebt = rng() < 0.8 ? int(rng, 50, 1200) : 0;
  // Skew the target back-end DTI toward healthy ratios (0.18..0.52, mass low).
  const targetBackDTI = 0.18 + Math.pow(rng(), 1.6) * 0.34;
  const grossMonthlyIncome = (housing + otherDebt) / targetBackDTI;

  // Employment tenure: 82% have >= 24 months on the job.
  const monthsOnJob = rng() < 0.82 ? int(rng, 24, 240) : int(rng, 3, 23);

  // Reserves: 82% target at/above the product minimum (in months of housing payment).
  const cashToClose = downPayment + loanAmount * 0.03;
  const reserveMonthsTarget = rng() < 0.82
    ? int(rng, product.minReserveMonths, 18)
    : int(rng, 0, Math.max(0, product.minReserveMonths - 1));
  const liquid = Math.round(cashToClose + reserveMonthsTarget * housing);

  const property: Property = {
    address: { street: `${int(rng, 100, 9999)} Oak Ave`, city, state: st, zip: '00000', monthsAtAddress: 0, kind: 'mailing' },
    type: pick(rng, ['single-family', 'condo', 'townhouse'] as const),
    occupancy: 'primary',
    estimatedValue: value,
    purchasePrice: purpose === 'purchase' ? value : undefined,
  };

  const loan: LoanRequest = {
    purpose, productId: product.id, loanAmount, termMonths: term,
    noteRate: quote.noteRate, lockDays: pick(rng, [30, 45, 60] as const), downPayment,
  };

  const assets: Asset[] = [{ kind: 'checking', institution: 'First Bank', balance: liquid, liquid: true }];
  const liabilities: Liability[] = otherDebt > 0
    ? [{ kind: 'revolving', creditor: 'CardCo', monthlyPayment: otherDebt, balance: otherDebt * int(rng, 12, 40), paidOffAtClosing: false }]
    : [];

  const state = pick(rng, STATES);
  const documents: LoanDocument[] = [
    { id: 'd1', type: 'paystub', label: 'Most recent paystub', state: 'requested', blocking: true, fileNames: [] },
    { id: 'd2', type: 'w2', label: 'W-2 (2 years)', state: 'requested', blocking: true, fileNames: [] },
    { id: 'd3', type: 'bank-statement', label: 'Bank statement', state: 'requested', blocking: true, fileNames: [] },
  ];

  const num = `LN-2026-${String(seed).padStart(6, '0')}`;
  const now = '2026-06-11T00:00:00.000Z';

  return {
    id: `app-${seed}`,
    loanNumber: num,
    state,
    createdAt: now,
    updatedAt: now,
    loanOfficerId: pick(rng, LO_IDS),
    // Co-borrower (40%) splits income and carries an equal/higher score so the representative
    // (minimum) score stays the calibrated `score`.
    borrowers: rng() < 0.4
      ? [
          makeBorrower(rng, true, score, grossMonthlyIncome * 0.6, monthsOnJob),
          makeBorrower(rng, false, Math.min(800, score + int(rng, 0, 40)), grossMonthlyIncome * 0.4, int(rng, 24, 200)),
        ]
      : [makeBorrower(rng, true, score, grossMonthlyIncome, monthsOnJob)],
    property,
    loan,
    assets,
    liabilities,
    realEstateOwned: [],
    documents,
    conditions: [],
    disclosures: [],
    // The entity's stored history (domain data). On inspection the app maps these into the Web Audit
    // standard's AuditEvent and appends them to the audit provider (the audit-trail block, active).
    audit: [{ at: now, actor: 'system', action: 'created' }],
  };
}

export function generatePipeline(count = 5000): Application[] {
  const apps: Application[] = [];
  for (let i = 1; i <= count; i++) apps.push(generateApplication(i));
  return apps;
}

export const ROLE_LABEL: Record<Role, string> = {
  'borrower': 'Borrower',
  'loan-officer': 'Loan Officer',
  'processor': 'Processor',
  'underwriter': 'Underwriter',
  'admin': 'Admin',
};
