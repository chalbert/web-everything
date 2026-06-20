/**
 * `CustomIntlProviderRegistry` (standalone model, #1055) — the swap point of the Intl-formatting
 * protocol (#1020, contract #1054).
 *
 * Unlike the multi-handler `customRecovery` registry (ordered, first-accept-wins) or the keyed
 * `customGuards` registry, the Intl seam resolves to a **single active provider** — the whole subtree
 * formats through *one* `CustomIntlProvider` at a time (a polyfill, a pinned-ICU build, or the
 * native-first default — never a blend). So this is a single-slot model: `set()` installs the active
 * provider, `current()` returns it. It is a dependency-free model of the contract — the runtime
 * `customIntl` plug fulfils the same surface as a core `CustomRegistry`, so the resolution policy has one
 * home and cannot drift.
 *
 * Two rulings from the contract are pinned here, not redecided:
 *  - **Native-first default.** A fresh registry resolves to the platform `Intl` (`nativeIntlProvider`) —
 *    formatting works with zero configuration. `set()` substitutes *all four* formatters at once
 *    (collator / date / number / relative-time), since a provider is whole.
 *  - **Single active provider, not a chain.** There is no ordered iteration: the most recent `set()`
 *    wins outright (nearest-scope-wins is the injector chain's job across scopes, not this registry's).
 */
import type { CustomIntlProvider } from './contract.js';
import { nativeIntlProvider } from './provider.js';

/**
 * Single-slot registry holding the **active** Intl provider. Mirrors the `CustomRegistry` surface the
 * runtime plug extends (`localName` + a get/set pair), kept self-contained here. A fresh registry starts
 * on the native-first default (`nativeIntlProvider`); `set()` installs a custom provider that replaces
 * all four formatters at once; `current()` is the single entry point a consumer resolves through (it
 * never constructs `Intl.*` directly, so the swap can't be bypassed).
 */
export class CustomIntlProviderRegistry {
  readonly localName = 'customIntl';
  #provider: CustomIntlProvider = nativeIntlProvider;

  /** Install `provider` as the active Intl provider, replacing all four formatters at once. */
  set(provider: CustomIntlProvider): void {
    this.#provider = provider;
  }

  /** The active provider — the native-first default until a custom provider is `set()`. */
  current(): CustomIntlProvider {
    return this.#provider;
  }

  /** Reset to the native-first default provider (drops any custom provider). */
  reset(): void {
    this.#provider = nativeIntlProvider;
  }
}
