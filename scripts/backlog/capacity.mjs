// Pure capacity-estimate helpers for the points-budgeted batch. The estimator is the **pooled affine
// context-cost model** ratified in backlog #1505: `context% = overhead + cost·points`, fit over the
// stored close-out tuples of EVERY batch — capacity-bound and work-bound alike. (Earlier the estimate was
// a single ratio through the origin trained only on the rare capacity-bound stop, which starved: ~90% of
// batches are work-bound by design — the budget is set below capacity — so the exclusion gate discarded
// almost all the data and the estimate rested on one sample.)
//
// Why affine, and why every batch: the intercept is the fixed per-batch overhead (pack/plan/gate/declines)
// — real work present in *every* batch, not waste peculiar to a stop reason — so it is one universal
// intercept that averages out across all batches, and the live residuals showed no systematic work-bound
// inflation (so no per-stop-reason term is needed). Stop-reason is therefore pure audit metadata; it no
// longer gates training. The next-batch budget is the largest P that fits under a context ceiling, minus a
// data-driven margin sized to the fit's own residual spread (a tight fit → small margin; a noisy fit →
// larger one) — replacing the arbitrary ×0.6 fraction. See backlog #1505 + reports/2026-06-22-calibrator-affine-cost-estimator.md.

// Every stop reason the calibrate CLI recognises (audit metadata only since #1505 — it no longer gates
// training). A `--stop-reason` token outside this set is a typo or an un-listed reason; the CLI rejects it
// (fail-closed) rather than recording a garbage tag.
export const KNOWN_STOP_REASONS = new Set([
  'budget', 'context',                                  // capacity-bound
  'empty-pool', 'empty', 'fork', 'gate', 'manual', 'abort', 'outgrew', // work-bound
]);

/** Is this a stop reason the calibrate CLI recognises? (Empty/absent is allowed — calibrate omits the tag.) */
export function isKnownStopReason(stopReason) {
  return KNOWN_STOP_REASONS.has(stopReason);
}

/**
 * Deming (errors-in-variables) fit of `context% = overhead + cost·points` over ALL samples' raw
 * `(points, contextPct)` tuples (#1505: every batch contributes; the `excluded`/`stopReason`/legacy
 * `impliedCapacity` fields are ignored — only the raw coordinates are read, so existing history bootstraps
 * the model with no warm-up). `lambda` = the assumed error-variance ratio var(ε_context)/var(ε_points);
 * 1 treats both axes as equally noisy (both are coarse — points is an aggregate, context% a human meter
 * reading), which de-biases the slope attenuation plain OLS suffers.
 *
 * Returns `{ overhead, cost, n, residualStd }`, or `null` when the fit is underdetermined (fewer than 2
 * usable tuples, no spread in points, or a non-positive slope — a degenerate fit the caller must reject
 * and fall back from).
 */
export function fitAffineCost(samples, { lambda = 1 } = {}) {
  const pts = (Array.isArray(samples) ? samples : [])
    .map((s) => [Number(s?.points), Number(s?.contextPct)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0);
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, [x]) => a + x, 0) / n;
  const my = pts.reduce((a, [, y]) => a + y, 0) / n;
  const sxx = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0) / (n - 1);
  const syy = pts.reduce((a, [, y]) => a + (y - my) ** 2, 0) / (n - 1);
  const sxy = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / (n - 1);
  if (sxx <= 0 || sxy <= 0) return null; // no points spread, or a non-positive association → reject
  const cost = (syy - lambda * sxx + Math.sqrt((syy - lambda * sxx) ** 2 + 4 * lambda * sxy * sxy)) / (2 * sxy);
  if (!(cost > 0)) return null;
  const overhead = my - cost * mx;
  // Vertical residual spread around the fitted line — the basis for the data-driven margin (budgetFromFit).
  const ssr = pts.reduce((a, [x, y]) => a + (y - (overhead + cost * x)) ** 2, 0);
  const residualStd = n > 2 ? Math.sqrt(ssr / (n - 2)) : 0;
  return { overhead, cost, n, residualStd };
}

/**
 * Next-batch points budget from an affine fit (#1505 Fork 1 (b)): the largest P that keeps the predicted
 * context under `ceiling`, after backing the ceiling off by a data-driven margin `k · residualStd` (≈ a
 * one-sided confidence cushion at k≈1). So `P = (ceiling − overhead − k·residualStd) / cost`. A tight fit
 * (small residualStd) spends almost the whole ceiling; a noisy fit holds more back. Returns a rounded
 * points budget, or `null` when the fit is missing/degenerate or leaves no headroom (caller falls back).
 */
export function budgetFromFit(fit, { ceiling = 80, k = 1 } = {}) {
  if (!fit || !(fit.cost > 0)) return null;
  const headroom = ceiling - fit.overhead - k * (fit.residualStd ?? 0);
  if (!(headroom > 0)) return null;
  return Math.round(headroom / fit.cost);
}

/**
 * Implied full-window capacity (points at 100% context) for display / back-compat: `(100 − overhead)/cost`.
 * Returns null on a missing/degenerate fit.
 */
export function impliedCapacity(fit) {
  if (!fit || !(fit.cost > 0)) return null;
  const p = (100 - fit.overhead) / fit.cost;
  return p > 0 ? Math.round(p) : null;
}
