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
 *
 * #2747 review — TWO hardenings, both from real crash/corruption modes:
 *
 *  1. EVERY candidate zone is VALIDATED before use. `Intl.DateTimeFormat` accepts IANA names only, and
 *     throws `RangeError: Invalid time zone specified` on values that are perfectly legal in `TZ` — the
 *     full POSIX form (`EST5EDT,M3.2.0,M11.1.0`), a `GMT+5` offset spelling, or a simple typo (all three
 *     verified to throw on this runtime). Feeding the raw env value straight in meant EVERY date-stamping
 *     script (`backlog.mjs` claim/resolve/scaffold, `check-backlog-workflow`, `audit-backlog-health`)
 *     hard-crashed on such a host. Each candidate is now probed and skipped if invalid, so a bad `TZ`
 *     degrades to the next source instead of taking the CLI down. `UTC` is the final, always-valid backstop.
 *
 *  2. The date is assembled from `formatToParts`, not from a locale's default pattern. The previous code
 *     relied on `sv-SE` happening to render `YYYY-MM-DD`; on a Node built with small-icu that locale is not
 *     available and the format silently degrades to the fallback locale's pattern (e.g. `MM/DD/YYYY`),
 *     which would write a corrupt date into frontmatter rather than fail loudly. Reading the year/month/day
 *     parts and joining them ourselves makes the output shape independent of locale data.
 */

/** Is `tz` a timezone `Intl` will actually accept? Pure (no env read). Empty/absent ⇒ false. */
export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the configured operator timezone: BACKLOG_TZ → TZ → host-resolved IANA zone → 'UTC'.
 * Each candidate is validated; an invalid one is SKIPPED (never thrown), so a POSIX-form or typo'd `TZ`
 * degrades instead of crashing every date-stamping script.
 */
export function resolveTimeZone(env = process.env) {
  for (const candidate of [env.BACKLOG_TZ, env.TZ]) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  try {
    const host = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimeZone(host)) return host;
  } catch { /* fall through to the UTC backstop */ }
  return 'UTC';
}

/**
 * Format a Date (default: now) as a `YYYY-MM-DD` calendar date in the given (or resolved) timezone.
 * Assembled from `formatToParts` so the shape never depends on a locale's default pattern (see header).
 * An invalid explicit `timeZone` falls back to the resolved zone rather than throwing.
 */
export function localDateString(date = new Date(), timeZone = resolveTimeZone()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : resolveTimeZone();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The operator's local "today" as `YYYY-MM-DD`, per the resolved timezone. */
export function localToday(timeZone = resolveTimeZone()) {
  return localDateString(new Date(), timeZone);
}
