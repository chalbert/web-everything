/**
 * review-seat-cap-near-limit — card xn2wf9t (#3383 follow-up): a non-Claude review seat provider (`codex`,
 * `agy-claude`, `agy-gemini` — `review-extra-seats.mjs#REVIEW_SEAT_PROVIDERS`) is closing in on its OWN daily
 * call cap (`review-extra-seats.mjs#resolveProviderCap`). Each provider is now metered separately (the split
 * this card made: a shared cap let Codex's comparatively tight weekly allowance starve the two, separately
 * generous, antigravity backends — 474 seat calls skipped in one day on `daily-cap` with the OTHER providers
 * still well under their own real budget).
 *
 * RECORD-ONLY BY DESIGN (this card's own ask): this smell is never added to
 * `health-smells-notify-list.mjs#NOTIFY_EVEN_IN_SHADOW`, so it stays in the watch's default shadow mode — every
 * tick's reading is recorded (and visible in the health report) but nothing here ever pages the operator. The
 * operator calibrates the caps themselves (env vars, or the review daemon's plist) off what this records; this
 * smell's own job is only to make "provider X is at 84% of its cap" visible without anyone asking for it by hand.
 *
 * Breaches once ANY provider's usedToday/cap fraction reaches {@link WARN_FRACTION} (80%). `usedToday` already
 * folds in outstanding reservations that have not yet landed a scorecard row (via the ledger — see
 * `reserveSeatCalls`), so this reads the SAME number `runExtraSeats`/`runRedTeam` gate on, not a separate
 * estimate.
 */
import { MINUTE } from '../health-watch-core.mjs';

export const WARN_FRACTION = 0.8;

export default {
  id: 'review-seat-cap-near-limit',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['reviewSeatCaps'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'low',
  action: 'investigate',
  recommendationHint: 'a non-Claude review seat provider is nearing its own daily call cap — record-only; raise its WE_REVIEW_SEAT_CAP_* env var (or the review daemon plist) if it is actually starving reviews.',
  evaluate({ reviewSeatCaps }, { now }) {
    void now; // the probe already samples "today" in America/New_York (`review-extra-seats.mjs#capDay`)
    const usage = reviewSeatCaps && typeof reviewSeatCaps === 'object' ? reviewSeatCaps : {};
    return Object.entries(usage).map(([provider, u]) => {
      const fraction = typeof u?.fraction === 'number' ? u.fraction : null;
      const breach = fraction != null && fraction >= WARN_FRACTION;
      return {
        subject: `review-seat-cap:${provider}`,
        breach,
        measure: { provider, usedToday: u?.usedToday ?? null, cap: u?.cap ?? null, fraction },
        summary: `${provider}: ${u?.usedToday ?? '?'}/${u?.cap ?? '?'} non-Claude review seat calls used today${fraction != null ? ` (${Math.round(fraction * 100)}%)` : ''}.`,
        recommendation: breach
          ? `${provider} is at ${Math.round((fraction ?? 0) * 100)}% of its own daily review-seat cap — raise its own env var (see this smell's header) if seats are being skipped because of it, or leave it: another provider with budget still runs the seat (never "no seat").`
          : 'ok',
      };
    });
  },
};
