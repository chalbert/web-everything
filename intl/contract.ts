/**
 * Intl-formatting protocol — the **pure-contract half** (#1020, slice #1054).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/intl` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`. The
 * runtime half — the native-first default provider (#1055) and the `customIntl` swap registry — is impl
 * and lives in FUI; only the contract crosses the seam (npm scope mirrors layer).
 *
 * The platform already ships `Intl.*` (Collator / DateTimeFormat / NumberFormat / RelativeTimeFormat).
 * What it lacks is a **swap seam**: a single provider a subtree resolves through the injector chain so a
 * polyfill, a pinned-ICU build, or a test double can substitute *every* formatter app-wide with one
 * `injector.set(...)`, without a consumer ever constructing `Intl.*` directly. This is a genuine
 * Protocol — independent Intl engines conform to one `CustomIntlProvider` contract (a real provider
 * seam, per the Project/Protocol bar).
 *
 * Two rulings are encoded here, not redecided downstream:
 *  - **Native-first.** The default provider is the platform `Intl` verbatim (slice #1055); the contract
 *    *adds the swap seam*, it never re-implements collation/date/number/relative-time formatting. The
 *    return types ARE the native `Intl.*` instance types — a custom provider must produce conformant
 *    formatters, not a parallel shape.
 *  - **Factory, not value.** A provider returns a *formatter* per `(locales, options)` call (the native
 *    constructor contract — options vary per call site), never a single pre-built formatter, so caching
 *    is the provider's concern. This module covers the four formatters #1054 scopes; `PluralRules` /
 *    `ListFormat` / `DisplayNames` are the platform defaults the message layer composes, tracked
 *    separately from this swap seam.
 */

/**
 * Locales argument, matching the native `Intl.*` constructor signature: a single BCP-47 tag, an ordered
 * list (preference → fallback), or `undefined` for the runtime default locale.
 */
export type IntlLocales = string | readonly string[] | undefined;

/**
 * A swappable Intl-formatting provider. Each method mirrors a native `Intl.*` constructor — same
 * `(locales, options)` arguments, same instance return type — so the platform `Intl` *is* a conformant
 * provider with zero adaptation (the native-first default, #1055). A custom provider (polyfill, pinned
 * ICU, test double) is resolved nearest-scope-wins through the injector chain and substitutes all four
 * formatters at once.
 */
export interface CustomIntlProvider {
  /** Stable identifier, surfaced for legibility (`data-intl-provider`). */
  readonly name: string;
  /** Locale-aware string comparison / sorting — native `Intl.Collator`. */
  getCollator(locales?: IntlLocales, options?: Intl.CollatorOptions): Intl.Collator;
  /** Locale-aware date / time formatting — native `Intl.DateTimeFormat`. */
  getDateTimeFormat(locales?: IntlLocales, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
  /** Locale-aware number / currency / unit formatting — native `Intl.NumberFormat`. */
  getNumberFormat(locales?: IntlLocales, options?: Intl.NumberFormatOptions): Intl.NumberFormat;
  /** Locale-aware relative time ("2 days ago") — native `Intl.RelativeTimeFormat`. */
  getRelativeTimeFormat(
    locales?: IntlLocales,
    options?: Intl.RelativeTimeFormatOptions,
  ): Intl.RelativeTimeFormat;
}
