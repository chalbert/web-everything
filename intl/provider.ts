/**
 * Intl-formatting protocol — the **runtime-impl half** (#1020, slice #1055).
 *
 * The **native-first default provider** — the runtime that fulfils the contract when no override is
 * wired. The pure-contract half (types/interfaces, compile-erased) is its sibling `./contract.ts`, the
 * future `@webeverything/contracts/intl` entry; the `customIntl` registry that swaps providers lives in
 * `./registry.ts`, the default wiring in `./index.ts`. This file re-exports the contract surface
 * (`export type * from './contract.js'`) so importers reach the types and the runtime from one site —
 * the split is at the *file* seam, not the public surface (mirrors `analytics/provider.ts` /
 * `reliability/provider.ts`).
 *
 * Two rulings from the contract are pinned here, not redecided:
 *  - **Native-first.** The default provider delegates verbatim to the platform `Intl.*` constructors —
 *    it *adds the swap seam*, it never re-implements collation / date / number / relative-time
 *    formatting. The platform `Intl` *is* the conformant provider; this class is the thin object that
 *    makes it resolvable through the injector chain.
 *  - **Factory, not value.** Each method returns a *fresh formatter* per `(locales, options)` call (the
 *    native constructor contract — options vary per call site). Constructing native `Intl.*` is already
 *    internally cached by the engine, so this provider adds no caching of its own; a custom provider may
 *    cache as it sees fit (that is the provider's concern, per the contract).
 */
import type { CustomIntlProvider, IntlLocales } from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

/**
 * The native-first default provider: every method delegates straight to the platform `Intl.*`
 * constructor with the same `(locales, options)` arguments and returns the native instance. This is the
 * floor a project gets with zero configuration; it is swapped out the moment a project `define()`s a
 * custom `CustomIntlProvider` (a polyfill, a pinned-ICU build, a test double) on the `customIntl`
 * registry.
 */
export class NativeIntlProvider implements CustomIntlProvider {
  readonly name = 'native';

  getCollator(locales?: IntlLocales, options?: Intl.CollatorOptions): Intl.Collator {
    return new Intl.Collator(locales, options);
  }

  getDateTimeFormat(locales?: IntlLocales, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(locales, options);
  }

  getNumberFormat(locales?: IntlLocales, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    return new Intl.NumberFormat(locales, options);
  }

  getRelativeTimeFormat(
    locales?: IntlLocales,
    options?: Intl.RelativeTimeFormatOptions,
  ): Intl.RelativeTimeFormat {
    return new Intl.RelativeTimeFormat(locales, options);
  }
}

/** The shared singleton native provider — there is no per-instance state, so one is enough. */
export const nativeIntlProvider: CustomIntlProvider = new NativeIntlProvider();
