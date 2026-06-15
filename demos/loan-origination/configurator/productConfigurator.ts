/**
 * Phase S6 — product & rate configurator (backlog #384, exercise app A / #317).
 *
 * The constraint-graph core: given an application, evaluate every catalog product's eligibility
 * constraints (occupancy ∈ product, score ≥ min, LTV ≤ max, amount in [min,max], term offered) and filter
 * to the eligible set — and, for the ineligible ones, surface *which* constraint failed (the "why-not"
 * view that makes this a Technical-Configurator / NL-to-config constraint graph, M5, not just a dropdown).
 * Selecting a product derives rate/price from the rate sheet (base + LLPA) and recomputes payment / APR /
 * cash-to-close.
 *
 * Pure functions over the existing pricing domain (`catalog.ts`) + derived facts (`facts.ts`) — no DOM,
 * so the constraint + pricing logic is independent of the view.
 */
import { PRODUCTS, priceLoan, monthlyPI, type Product } from '../domain/catalog';
import { deriveFacts } from '../domain/facts';
import type { Application } from '../domain/types';

/** One constraint edge in the product's eligibility graph, evaluated against the application. */
export interface ConstraintResult {
  label: string;
  ok: boolean;
  /** Human detail, e.g. "score 705 ≥ 620" or "LTV 92.0% > 80.0%". */
  detail: string;
}

export interface ProductEligibility {
  product: Product;
  eligible: boolean;
  constraints: ConstraintResult[];
  /** The constraints that failed (empty when eligible) — the "why-not" set. */
  failed: ConstraintResult[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Evaluate one product's eligibility constraints against the application's derived facts. */
export function evaluateEligibility(app: Application, product: Product): ProductEligibility {
  const facts = deriveFacts(app);
  const score = facts.representativeCreditScore;
  const ltv = facts.ltv;
  const amount = app.loan.loanAmount;
  const term = app.loan.termMonths;
  const occ = app.property.occupancy;

  const constraints: ConstraintResult[] = [
    { label: 'Credit score', ok: score >= product.minScore, detail: `${score} ${score >= product.minScore ? '≥' : '<'} ${product.minScore}` },
    { label: 'LTV ceiling', ok: ltv <= product.maxLTV, detail: `${pct(ltv)} ${ltv <= product.maxLTV ? '≤' : '>'} ${pct(product.maxLTV)}` },
    { label: 'Occupancy', ok: product.occupancies.includes(occ), detail: product.occupancies.includes(occ) ? occ : `${occ} not offered` },
    {
      label: 'Loan amount',
      ok: amount >= product.minLoanAmount && amount <= product.maxLoanAmount,
      detail: `$${amount.toLocaleString()} in [$${product.minLoanAmount.toLocaleString()}–$${product.maxLoanAmount.toLocaleString()}]`,
    },
    { label: 'Term offered', ok: product.termMonths.includes(term), detail: `${term / 12}yr ${product.termMonths.includes(term) ? 'offered' : 'not offered'}` },
  ];
  const failed = constraints.filter((c) => !c.ok);
  return { product, eligible: failed.length === 0, constraints, failed };
}

/** The full catalog evaluated, eligible products first. */
export function evaluateCatalog(app: Application): ProductEligibility[] {
  return PRODUCTS.map((p) => evaluateEligibility(app, p)).sort(
    (a, b) => Number(b.eligible) - Number(a.eligible),
  );
}

export type LockDays = 30 | 45 | 60;

export interface ConfiguredQuote {
  productId: string;
  lockDays: LockDays;
  noteRate: number;
  llpaAdjustment: number;
  /** Additive rate for the chosen lock period (longer lock costs more). */
  lockAdjustment: number;
  monthlyPrincipalInterest: number;
  /** P&I + estimated taxes & insurance. */
  monthlyPayment: number;
  /** Annual percentage rate including financed closing costs (illustrative approximation). */
  apr: number;
  cashToClose: number;
}

const TAX_INSURANCE_FACTOR = 0.013 / 12; // mirror facts.ts
const CLOSING_COST_FACTOR = 0.03;

/** Lock-period rate adjustment — the `lock` axis of the (product, LTV, credit, term, lock) rate-sheet key. */
const LOCK_ADJUSTMENT: Record<LockDays, number> = { 30: 0, 45: 0.00125, 60: 0.0025 };

/**
 * Price the application against a chosen product: rate from the sheet (base + LLPA by credit/LTV band +
 * the lock-period adjustment), monthly P&I, full monthly payment (+ T&I), an APR that amortizes the
 * financed closing costs, and cash-to-close. Returns null when the product isn't priceable (unknown id).
 */
export function configureQuote(app: Application, productId: string, lockDays: LockDays = 30): ConfiguredQuote | null {
  const facts = deriveFacts(app);
  const quote = priceLoan(productId, app.loan.loanAmount, app.loan.termMonths, facts.representativeCreditScore, facts.ltv);
  if (!quote) return null;

  const lockAdjustment = LOCK_ADJUSTMENT[lockDays];
  const noteRate = quote.noteRate + lockAdjustment;
  const monthlyPrincipalInterest = monthlyPI(app.loan.loanAmount, noteRate, app.loan.termMonths);
  const taxesInsurance = app.property.estimatedValue * TAX_INSURANCE_FACTOR;
  const monthlyPayment = monthlyPrincipalInterest + taxesInsurance;
  const closingCosts = app.loan.loanAmount * CLOSING_COST_FACTOR;
  const cashToClose = app.loan.downPayment + closingCosts;
  const apr = approximateApr(app.loan.loanAmount, closingCosts, noteRate, app.loan.termMonths);

  return {
    productId,
    lockDays,
    noteRate,
    llpaAdjustment: quote.llpaAdjustment,
    lockAdjustment,
    monthlyPrincipalInterest,
    monthlyPayment,
    apr,
    cashToClose,
  };
}

/**
 * APR ≈ the rate whose payments (computed at the note rate over the full loan) discount to the *net*
 * proceeds (loan amount − prepaid finance charges). Solved by bisection — illustrative, not a Reg-Z
 * compliant computation (the exercise app drives the standard, it is not a compliant LOS).
 */
export function approximateApr(loanAmount: number, financeCharges: number, noteRate: number, termMonths: number): number {
  const payment = monthlyPI(loanAmount, noteRate, termMonths);
  const net = loanAmount - financeCharges;
  if (net <= 0) return noteRate;
  // PV of the payment stream at monthly rate r should equal `net`; find r, return annualized.
  const pv = (monthlyRate: number) =>
    monthlyRate === 0 ? payment * termMonths : (payment * (1 - Math.pow(1 + monthlyRate, -termMonths))) / monthlyRate;
  let lo = 0;
  let hi = 0.02; // 24% annual ceiling for the search
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > net) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12;
}
