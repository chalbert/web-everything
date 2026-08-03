/**
 * local-date.mjs — the operator-local date-only stamp helper (#2747).
 *
 * Backlog date-only frontmatter (`dateOpened` / `dateStarted` / `dateResolved` / `preparedDate`) must
 * reflect the OPERATOR's calendar day, not the AI runtime's UTC clock. Slicing `new Date().toISOString()`
 * reads UTC, so a UTC-behind operator gets stamped a day ahead during the evening window where it's
 * still "today" for them but already "tomorrow" in UTC.
 *
 * ## Which clock is "the operator's"?
 *
 * Node's own local time — the offset `Date` already uses. We deliberately do NOT re-derive a zone NAME
 * and hand it back to `Intl`: an `Intl.DateTimeFormat` with no `timeZone` option formats in exactly the
 * zone `Date` is using, whatever produced it, so the stamped day can never disagree with the process's
 * own local time.
 *
 * That round-trip is not hypothetical (#2747 review finding 1, reproduced on node 22): `TZ` is a POSIX
 * variable, not an IANA name. With `TZ=GMT+5` POSIX means UTC−5, but
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` normalises it to the string `"+05:00"` — a VALID
 * zone meaning UTC+5. Feeding that name back in stamps a day computed 10 hours away from the process's
 * real local time, i.e. it re-creates the exact bug this item fixes, with the sign flipped. `TZ=+05:00`
 * diverges the same way (`Date` ignores that form entirely), and `TZ=UTC+8` / `TZ=EST5` make
 * `resolvedOptions().timeZone` return nothing at all. Formatting with NO zone matched `Date` in every
 * one of those cases.
 *
 * So there is exactly ONE knob, and it is not `TZ`:
 *
 *   `BACKLOG_TZ` — an explicit IANA pin (e.g. `America/Toronto`) for the operator whose HOST clock is
 *   already wrong, typically a UTC container. Unset (the normal case) ⇒ Node's own local time.
 *
 * `TZ` needs no rung of its own: Node already derives its local time from it, so the no-zone path honours
 * it — correctly, including the POSIX forms an IANA lookup mangles.
 *
 * ## Loud, never silent
 *
 * Every failure mode here writes a WRONG DATE into frontmatter that no gate can spot (it is still a
 * well-formed `YYYY-MM-DD`), so this module has no silent-degrade paths:
 *
 *  - A `BACKLOG_TZ` that `Intl` rejects (a typo, or a POSIX/offset spelling) THROWS. Skipping it silently
 *    would ignore an explicit pin from the one population that needs it most — the operator whose host
 *    zone is already wrong — and their evidence that the pin "didn't work" would be identical to never
 *    having set it (#2747 review finding 2).
 *  - An explicit `timeZone` argument is used as given; `Intl` throws on a bad one. No swap-in fallback.
 *  - A missing year/month/day part throws rather than yielding `2026-08-` or `--`.
 *
 * ## Shape
 *
 * The date is assembled from `formatToParts`, not from a locale's default pattern: relying on `sv-SE`
 * happening to render `YYYY-MM-DD` breaks on a small-icu Node, where the format silently degrades to the
 * fallback locale's `MM/DD/YYYY` and writes a corrupt date. Reading the parts makes the shape independent
 * of locale data.
 *
 * ## Scope
 *
 * Only date-ONLY stamps route through this — enforced by `scripts/lib/utc-day-slice-scan.mjs`, run from
 * `check:standards`. Instant timestamps (the claims-ledger `nowIso`) legitimately want full UTC ISO and
 * must NOT be touched.
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
 * The operator's explicit zone pin, or `undefined` meaning "use Node's own local time".
 *
 * `undefined` is the normal answer and the correct default: passing no `timeZone` to `Intl` formats in
 * whatever zone `Date` is using, so the stamp can never disagree with the process's local clock. Only
 * `BACKLOG_TZ` overrides that, and an invalid `BACKLOG_TZ` THROWS rather than being ignored.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {string|undefined} an IANA zone name, or undefined for host-local
 */
export function backlogTimeZone(env = process.env) {
  const pin = env.BACKLOG_TZ;
  if (pin === undefined || pin === '') return undefined;
  if (!isValidTimeZone(pin))
    throw new Error(
      `BACKLOG_TZ="${pin}" is not a time zone Intl accepts, so backlog dates cannot be stamped. `
      + 'Use an IANA name (e.g. "America/Toronto") — POSIX spellings like "EST5EDT,M3.2.0,M11.1.0" or '
      + '"GMT+5" are not zone names. Unset BACKLOG_TZ to stamp in the host\'s own local time.');
  return pin;
}

/**
 * Format a given instant as a `YYYY-MM-DD` calendar date.
 *
 * @param {Date} date the instant to format — REQUIRED (for "now", call `localToday()`)
 * @param {string|undefined} [timeZone] IANA zone; omit for the `BACKLOG_TZ`-pinned-or-host-local default.
 *   An invalid value throws (via `Intl`); it is never swapped for something else.
 * @returns {string}
 */
export function localDateString(date, timeZone = backlogTimeZone()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new TypeError(`localDateString(date) requires a valid Date; got ${String(date)}`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`localDateString: no "${type}" part in the formatted date (timeZone=${timeZone ?? 'host'})`);
    return part.value;
  };
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * The operator's local "today" as `YYYY-MM-DD` — THE idiom every backlog date-only stamp must use.
 * Resolves the zone once and reads the clock once.
 */
export function localToday() {
  return localDateString(new Date());
}
