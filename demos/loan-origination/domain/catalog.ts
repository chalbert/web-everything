/**
 * Product catalog, rate sheet, and loan-level price adjustments (LLPAs).
 *
 * This is the data the product configurator (M5) filters and prices against, and the source of
 * the per-product eligibility constraints the rules engine (M6) reads (maxLTV, minScore, etc.).
 * Admin-editable in the full app; static here.
 */

export interface Product {
  id: string;
  name: string;
  category: 'conventional' | 'fha' | 'va' | 'jumbo';
  termMonths: number[];
  minScore: number;
  maxLTV: number;
  minReserveMonths: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  /** Occupancies this product allows. */
  occupancies: Array<'primary' | 'second-home' | 'investment'>;
}

export const PRODUCTS: Product[] = [
  {
    id: 'conv-30-fixed', name: '30-Year Fixed (Conventional)', category: 'conventional',
    termMonths: [360], minScore: 620, maxLTV: 0.97, minReserveMonths: 2,
    minLoanAmount: 50_000, maxLoanAmount: 766_550, occupancies: ['primary', 'second-home', 'investment'],
  },
  {
    id: 'conv-15-fixed', name: '15-Year Fixed (Conventional)', category: 'conventional',
    termMonths: [180], minScore: 620, maxLTV: 0.95, minReserveMonths: 2,
    minLoanAmount: 50_000, maxLoanAmount: 766_550, occupancies: ['primary', 'second-home', 'investment'],
  },
  {
    id: 'conv-arm-7-6', name: '7/6 ARM (Conventional)', category: 'conventional',
    termMonths: [360], minScore: 640, maxLTV: 0.90, minReserveMonths: 6,
    minLoanAmount: 50_000, maxLoanAmount: 766_550, occupancies: ['primary', 'second-home', 'investment'],
  },
  {
    id: 'fha-30-fixed', name: '30-Year Fixed (FHA)', category: 'fha',
    termMonths: [360], minScore: 580, maxLTV: 0.965, minReserveMonths: 1,
    minLoanAmount: 50_000, maxLoanAmount: 498_257, occupancies: ['primary'],
  },
  {
    id: 'va-30-fixed', name: '30-Year Fixed (VA)', category: 'va',
    termMonths: [360], minScore: 580, maxLTV: 1.0, minReserveMonths: 0,
    minLoanAmount: 50_000, maxLoanAmount: 766_550, occupancies: ['primary'],
  },
  {
    id: 'jumbo-30-fixed', name: '30-Year Fixed (Jumbo)', category: 'jumbo',
    termMonths: [360], minScore: 700, maxLTV: 0.80, minReserveMonths: 12,
    minLoanAmount: 766_551, maxLoanAmount: 3_000_000, occupancies: ['primary', 'second-home'],
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/**
 * Base note rate by product, before LLPAs. Decimal (0.0675 = 6.75%).
 */
const BASE_RATE: Record<string, number> = {
  'conv-30-fixed': 0.0675,
  'conv-15-fixed': 0.0599,
  'conv-arm-7-6': 0.0625,
  'fha-30-fixed': 0.0650,
  'va-30-fixed': 0.0640,
  'jumbo-30-fixed': 0.0700,
};

/**
 * Loan-level price adjustments expressed as additive rate bumps, keyed by credit band and LTV band.
 * Lower score / higher LTV -> higher rate. Illustrative.
 */
function creditBand(score: number): 0 | 1 | 2 | 3 {
  if (score >= 760) return 0;
  if (score >= 720) return 1;
  if (score >= 680) return 2;
  return 3;
}

function ltvBand(ltv: number): 0 | 1 | 2 {
  if (ltv <= 0.6) return 0;
  if (ltv <= 0.8) return 1;
  return 2;
}

// [creditBand][ltvBand] -> additive rate.
const LLPA_GRID: number[][] = [
  [0.0, 0.000, 0.0025], // 760+
  [0.0, 0.0025, 0.005], // 720-759
  [0.0025, 0.005, 0.0075], // 680-719
  [0.005, 0.0075, 0.0125], // <680
];

export interface PriceQuote {
  productId: string;
  noteRate: number;
  monthlyPrincipalInterest: number;
  llpaAdjustment: number;
}

/** Fixed-rate amortized monthly P&I. */
export function monthlyPI(loanAmount: number, annualRate: number, termMonths: number): number {
  const r = annualRate / 12;
  if (r === 0) return loanAmount / termMonths;
  return (loanAmount * r) / (1 - Math.pow(1 + r, -termMonths));
}

export function priceLoan(productId: string, loanAmount: number, termMonths: number, score: number, ltv: number): PriceQuote | null {
  const base = BASE_RATE[productId];
  if (base == null) return null;
  const llpa = LLPA_GRID[creditBand(score)][ltvBand(ltv)];
  const noteRate = base + llpa;
  return {
    productId,
    noteRate,
    llpaAdjustment: llpa,
    monthlyPrincipalInterest: monthlyPI(loanAmount, noteRate, termMonths),
  };
}
