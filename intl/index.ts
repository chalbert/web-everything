/**
 * Default wiring for the Intl-formatting protocol seam (#1020/#1055). Builds the standalone `customIntl`
 * registry seeded with the **native-first default provider** — the platform `Intl` verbatim — so a
 * consumer gets a working, swappable seam with one call and `set()`s a custom provider (polyfill,
 * pinned-ICU, test double) on top when needed. Mirrors `reliability/index.ts` / `analytics`'s default
 * wiring, with the difference that this seam ships a real default (native-first), not an empty/no-op one.
 */
import { CustomIntlProviderRegistry } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/**
 * A fresh Intl provider registry seeded with the native-first default (`nativeIntlProvider`).
 * `current()` returns the platform `Intl` until the consumer `set()`s a custom provider.
 */
export function createDefaultRegistry(): CustomIntlProviderRegistry {
  return new CustomIntlProviderRegistry();
}
