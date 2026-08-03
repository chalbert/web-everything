/**
 * local-date.mjs — the operator-local date-only stamp helper (#2747).
 *
 * Backlog date-only frontmatter (`dateOpened` / `dateStarted` / `dateResolved` / `preparedDate`) must
 * reflect the OPERATOR's calendar day, not the AI runtime's UTC clock. Slicing `new Date().toISOString()`
 * reads UTC, so a UTC-behind operator gets stamped a day ahead during the evening window where it's
 * still "today" for them but already "tomorrow" in UTC.
 *
 * Zone resolution order: `BACKLOG_TZ` env → `TZ` env → the host's resolved IANA zone (`Intl
 * .DateTimeFormat().resolvedOptions().timeZone`). This lets an operator pin their real zone via env when
 * the host clock/zone doesn't already reflect it (e.g. a UTC container), while defaulting to "just work"
 * on a correctly-configured host.
 *
 * Only date-ONLY stamps route through this. Instant timestamps (the claims-ledger `nowIso`) legitimately
 * want full UTC ISO and must NOT be touched.
 */

/** Resolve the configured operator timezone: BACKLOG_TZ → TZ → host-resolved IANA zone. */
export function resolveTimeZone() {
  return process.env.BACKLOG_TZ || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a Date (default: now) as a `YYYY-MM-DD` calendar date in the given (or resolved) timezone.
 * Uses the `sv-SE` locale, whose default date format is already `YYYY-MM-DD` — no manual reassembly.
 */
export function localDateString(date = new Date(), timeZone = resolveTimeZone()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The operator's local "today" as `YYYY-MM-DD`, per the resolved timezone. */
export function localToday(timeZone = resolveTimeZone()) {
  return localDateString(new Date(), timeZone);
}
