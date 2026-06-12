/**
 * Runtime `customGuards` plug (#289) — the live counterpart to the dependency-free `guard/` model
 * shipped alongside, and the guard-protocol sibling of `CustomValidatorResolutionRegistry` /
 * `CustomValidityMergeRegistry`.
 *
 * Where the standalone model is a self-contained table, this is the **real plug**: a
 * `CustomRegistry<CustomGuardProvider>` (the same base every Web Everything registry extends) so it
 * participates in the injector chain — a scope sets one on its injector and regions below resolve it
 * nearest-scope-wins (#207 D6), exactly like `customValidatorResolution` / `customStores`. It reuses
 * the provider contract, the native default, and the decision guard from the `guard/` model verbatim —
 * only the registry base differs (core `CustomRegistry` here vs the standalone table there), so the
 * trust-boundary policy has one home and cannot drift.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  assertGuardDecision,
  NativeGuardProvider,
  type CustomGuardProvider,
  type GuardContext,
  type GuardDecision,
  type GuardEvent,
  type GuardRegion,
} from '../../guard/provider.js';
import { UnknownGuardProviderError } from '../../guard/registry.js';

/**
 * The live registry of named guard providers. Extends the core `CustomRegistry` (keyed by provider key)
 * so it is injector-chain-resolvable and inheritable via `extends`; adds the `define(provider, asDefault?)`
 * / `resolve(key?)` / `evaluateRegion(...)` surface the standalone model documents, deriving the
 * registration key from the provider's own `key` rather than a hand-passed name.
 */
export default class CustomGuardRegistry extends CustomRegistry<CustomGuardProvider> {
  localName = 'customGuards';
  #defaultKey: string | null = null;

  /**
   * Register a provider under its own `key`. The first registered — or one passed `asDefault` —
   * becomes the provider a region uses when its scope names none (the native-first permissive default,
   * by convention). Re-registering a key overrides it.
   */
  define(provider: CustomGuardProvider, asDefault = false): void {
    this.set(provider.key, provider);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = provider.key;
  }

  /** The key of the provider `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a provider by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownGuardProviderError` when the named (or default) provider is absent — the registry never
   * silently substitutes a different policy (and, for a guard, never silently allows).
   */
  resolve(key?: string): CustomGuardProvider {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownGuardProviderError('default', [...this.keys()]);
    const provider = this.get(wanted as string);
    if (!provider) throw new UnknownGuardProviderError(wanted, [...this.keys()]);
    return provider;
  }

  /**
   * Evaluate `event` on `region` under the resolved provider, validating the crossing answer through
   * `assertGuardDecision`. The single entry point a member intent calls — it never touches a provider's
   * `evaluate` directly, so the trust-boundary check can't be skipped.
   */
  async evaluateRegion(
    region: GuardRegion,
    event: GuardEvent,
    context?: GuardContext,
    providerKey?: string,
  ): Promise<GuardDecision> {
    const provider = this.resolve(providerKey);
    const decision = await provider.evaluate(region, event, context);
    return assertGuardDecision(provider.key, decision);
  }
}

/** A registry pre-loaded with the native-first default provider (the permissive default). */
export function createDefaultGuardRegistry(): CustomGuardRegistry {
  const registry = new CustomGuardRegistry();
  registry.define(new NativeGuardProvider(), true); // native-first default
  return registry;
}
