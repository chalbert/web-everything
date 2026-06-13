/**
 * @file scripts/lib/research-freshness.cjs
 * @description Research-freshness derivation (#441 Fork 4 / #477) — the single home for the
 *   staleness logic shared by check:standards' warn-only rule (ESM, re-exported via
 *   check-standards-rules.mjs) and the Eleventy `researchFreshness` filter (CJS .eleventy.js).
 *   Authored as CommonJS so the sync-only Eleventy 2.x config can `require` it directly, while the
 *   ESM rules module re-exports its named bindings — one derivation, two module systems, no drift.
 */

// Global review-horizon fallback: a topic without its own `reviewHorizon` is reviewed against this
// interval (ISO-8601 duration).
const RESEARCH_REVIEW_HORIZON_DEFAULT = 'P6M';
const FRESHNESS_DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;

/**
 * Add an ISO-8601 duration (Y/M/W/D, the subset the registry accepts) to a Date, calendar-correctly
 * (months/years via setUTCMonth/Year so P6M lands on the same day-of-month). Returns a new Date, or
 * null for an empty/malformed duration (incl. a bare "P").
 */
function addIsoDuration(date, duration) {
  const m = FRESHNESS_DURATION.exec(duration || '');
  if (!m || m[0] === 'P') return null;
  const [y, mo, w, d] = [m[1], m[2], m[3], m[4]].map((x) => (x ? parseInt(x, 10) : 0));
  const out = new Date(date.getTime());
  if (y) out.setUTCFullYear(out.getUTCFullYear() + y);
  if (mo) out.setUTCMonth(out.getUTCMonth() + mo);
  if (w || d) out.setUTCDate(out.getUTCDate() + w * 7 + d);
  return out;
}

/**
 * Derive a research topic's review-freshness from `lastReviewed` + `reviewHorizon`, with RFC 5861
 * grace-band semantics (stale-while-shown): once `now` is past `lastReviewed + horizon` the topic is
 * `stale` — *flagged for re-review, never hidden*. Pure and `now`-injected so the gate (warn-only)
 * and the freshness badge share one derivation.
 *
 *   state 'fresh'      — reviewed, still within its horizon
 *         'stale'      — reviewed, past its horizon (flag for re-review; the topic is still shown)
 *         'unreviewed' — no/invalid `lastReviewed` (or unparseable horizon): neutral, never warned
 *
 * @returns {{ state: 'fresh'|'stale'|'unreviewed', lastReviewed: string|null, horizon: string|null, dueDate: string|null }}
 */
function deriveResearchFreshness(topic, { now = new Date(), defaultHorizon = RESEARCH_REVIEW_HORIZON_DEFAULT } = {}) {
  const lastReviewed = (topic && topic.lastReviewed) || null;
  if (!lastReviewed || !/^\d{4}-\d{2}-\d{2}$/.test(lastReviewed))
    return { state: 'unreviewed', lastReviewed: null, horizon: null, dueDate: null };
  const horizon = topic.reviewHorizon || defaultHorizon;
  const dueDate = addIsoDuration(new Date(`${lastReviewed}T00:00:00Z`), horizon);
  if (!dueDate) return { state: 'unreviewed', lastReviewed, horizon, dueDate: null };
  const state = now.getTime() > dueDate.getTime() ? 'stale' : 'fresh';
  return { state, lastReviewed, horizon, dueDate: dueDate.toISOString().slice(0, 10) };
}

module.exports = { RESEARCH_REVIEW_HORIZON_DEFAULT, addIsoDuration, deriveResearchFreshness };
