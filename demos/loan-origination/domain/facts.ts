/**
 * Derived underwriting facts — the normalized inputs the rules engine evaluates.
 *
 * The engine never reads the raw Application; it reads this flat fact object so a rule is a simple
 * predicate over named numeric facts (keeps rules expressible as editable data — see rules.ts).
 */

import type { Application } from './types';
import { getProduct, monthlyPI } from './catalog';

export interface UnderwritingFacts {
  grossMonthlyIncome: number;
  /** Proposed total housing payment (P&I + taxes + insurance estimate). */
  housingPayment: number;
  /** All recurring monthly debt incl. proposed housing, excl. liabilities paid off at closing. */
  totalMonthlyDebt: number;
  frontEndDTI: number;
  backEndDTI: number;
  ltv: number;
  cltv: number;
  representativeCreditScore: number;
  liquidAssetsAfterClose: number;
  reserveMonths: number;
  minMonthsOnJob: number;
  /** Purchase only: do assets cover down payment + estimated closing + required reserves? */
  downPaymentCovered: boolean;
  // Product constraints lifted in so rules can compare against them.
  productMaxLTV: number;
  productMinScore: number;
  productMinReserveMonths: number;
}

const TAX_INSURANCE_FACTOR = 0.013 / 12; // ~1.3% of value annually for taxes+insurance, monthly.
const CLOSING_COST_FACTOR = 0.03; // ~3% of loan for estimated closing costs.

export function deriveFacts(app: Application): UnderwritingFacts {
  const product = getProduct(app.loan.productId);

  const grossMonthlyIncome = app.borrowers
    .flatMap((b) => b.employment)
    .flatMap((e) => e.income)
    .reduce((sum, i) => sum + i.monthlyAmount, 0);

  const pi = monthlyPI(app.loan.loanAmount, app.loan.noteRate, app.loan.termMonths);
  const taxesInsurance = app.property.estimatedValue * TAX_INSURANCE_FACTOR;
  const housingPayment = pi + taxesInsurance;

  const otherDebt = app.liabilities
    .filter((l) => !l.paidOffAtClosing)
    .reduce((sum, l) => sum + l.monthlyPayment, 0);
  const totalMonthlyDebt = housingPayment + otherDebt;

  const value = app.property.purchasePrice ?? app.property.estimatedValue;
  const ltv = app.loan.loanAmount / value;
  const subordinate = app.realEstateOwned.reduce((s, r) => s + 0, 0); // no subordinate liens modeled yet
  const cltv = (app.loan.loanAmount + subordinate) / value;

  const representativeCreditScore = Math.min(...app.borrowers.map((b) => b.creditScore));

  const liquidAssets = app.assets.filter((a) => a.liquid).reduce((s, a) => s + a.balance, 0);
  const cashToClose = app.loan.downPayment + app.loan.loanAmount * CLOSING_COST_FACTOR;
  const liquidAssetsAfterClose = Math.max(0, liquidAssets - cashToClose);
  const reserveMonths = housingPayment > 0 ? liquidAssetsAfterClose / housingPayment : 0;

  const tenures = app.borrowers.flatMap((b) => b.employment.map((e) => e.monthsOnJob));
  const minMonthsOnJob = tenures.length ? Math.min(...tenures) : 0;

  const downPaymentCovered =
    app.loan.purpose === 'refinance' ? true : liquidAssets >= cashToClose;

  return {
    grossMonthlyIncome,
    housingPayment,
    totalMonthlyDebt,
    frontEndDTI: grossMonthlyIncome > 0 ? housingPayment / grossMonthlyIncome : 1,
    backEndDTI: grossMonthlyIncome > 0 ? totalMonthlyDebt / grossMonthlyIncome : 1,
    ltv,
    cltv,
    representativeCreditScore,
    liquidAssetsAfterClose,
    reserveMonths,
    minMonthsOnJob,
    downPaymentCovered,
    productMaxLTV: product?.maxLTV ?? 0.8,
    productMinScore: product?.minScore ?? 620,
    productMinReserveMonths: product?.minReserveMonths ?? 2,
  };
}
