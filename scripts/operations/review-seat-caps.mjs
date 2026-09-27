/**
 * @file scripts/operations/review-seat-caps.mjs
 * @description Card xn2wf9t (#3383 follow-up) — the declared, read-only `review-seat-caps` operation: a
 *   `heavy-queue`-style one-liner + per-provider breakdown of the non-Claude review seats' OWN daily call caps
 *   (`review-extra-seats.mjs#REVIEW_SEAT_PROVIDERS`, one cap each since this same card split the old single
 *   shared cap). Mirrors `heavy-queue.mjs`'s own READ / ASSESS split: `collect` (bound in `run.mjs`) is the one
 *   real read (the shared scorecard store, via `review-extra-seats.mjs#reviewSeatCapUsage`); everything here is
 *   a pure function over that already-read snapshot — so the operator can calibrate each provider's cap
 *   (`WE_REVIEW_SEAT_CAP_CODEX` / `_AGY_CLAUDE` / `_AGY_GEMINI`) off the SAME numbers the gate itself reads,
 *   not a hand-rolled estimate.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const REVIEW_SEAT_CAPS_OP = 'review-seat-caps';

/**
 * Assess an already-read {@link ../operations/review-extra-seats.mjs#reviewSeatCapUsage} snapshot into rows plus
 * a one-line headline. PURE.
 * @param {Record<string, {usedToday:number, cap:number, fraction:(number|null)}>} usage
 */
export function assessReviewSeatCaps(usage) {
  if (!usage || typeof usage !== 'object') throw new TypeError('review-seat-caps: unreadable snapshot (expected a provider→usage map)');
  const rows = Object.entries(usage).map(([provider, u]) => ({
    provider, usedToday: u?.usedToday ?? null, cap: u?.cap ?? null,
    percent: typeof u?.fraction === 'number' ? Math.round(u.fraction * 100) : null,
  }));
  const headline = rows.length
    ? rows.map((r) => `${r.provider} ${r.usedToday ?? '?'}/${r.cap ?? '?'}${r.percent != null ? ` (${r.percent}%)` : ''}`).join(', ')
    : 'no review-seat providers configured';
  return { rows, headline: `review seat calls used today: ${headline}` };
}

/**
 * The declared operation. Read-only, no input required — same no-sinks reasoning as `heavy-queue`/
 * `daemon-status`: every step is `compute`, so no effect exists for a sink to apply. `collect` is the injected
 * IO ({@link ../conveyor/run-scorecard-store.mjs#readStore} + `review-extra-seats.mjs#reviewSeatCapUsage`),
 * bound to the real store only in `run.mjs`.
 * @param {{collect: () => Record<string, object>}} deps
 */
export function reviewSeatCapsOperation({ collect } = {}) {
  if (typeof collect !== 'function') throw new TypeError('review-seat-caps needs a collect reader');
  return op(REVIEW_SEAT_CAPS_OP, {
    input: {},
    verdictFrom: 'assess',
    read: compute({ reads: [], fn: () => collect() }),
    assess: compute({ reads: ['findings.read'], fn: ({ findings }) => assessReviewSeatCaps(findings.read) }),
  });
}
