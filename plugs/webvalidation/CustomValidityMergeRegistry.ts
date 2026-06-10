/**
 * Runtime `customValidityMerge` plug (#215) — the live counterpart to the dependency-free
 * `validity-merge/` model shipped by #212.
 *
 * Where the standalone model is a self-contained table (mirroring `capabilities/`), this is the
 * **real plug**: a `CustomRegistry<CustomValidityMergeStrategy>` (the same base every Web Everything
 * registry extends) so it participates in the injector chain — a scope sets one on its injector and
 * controls below resolve it nearest-scope-wins (#207 D6), exactly like `customStores` /
 * `customAttributes`. It reuses the strategies, surface types, and auto-stamping orchestrator from
 * the `validity-merge/` model verbatim — only the registry differs (core `CustomRegistry` here vs the
 * standalone table there), so the merge math has one home and cannot drift.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CustomValidityMergeStrategy,
  SourceReductionStrategy,
  LastWriteWinsStrategy,
} from '../../validity-merge/provider.js';
import { UnknownStrategyError } from '../../validity-merge/registry.js';

/**
 * The live registry of named merge strategies. Extends the core `CustomRegistry` (keyed by strategy
 * name) so it is injector-chain-resolvable; adds the validity-merge `define(strategy, asDefault?)` /
 * `resolve(key?)` surface the standalone model documents, deriving the registration key from the
 * strategy's own `key` rather than a hand-passed name.
 */
export default class CustomValidityMergeRegistry extends CustomRegistry<CustomValidityMergeStrategy> {
  localName = 'customValidityMerge';
  #defaultKey: string | null = null;

  /**
   * Register a strategy under its own `key`. The first registered — or one passed `asDefault` —
   * becomes the strategy a control uses when its scope names none (the native-first source-reduction,
   * by convention). Re-registering a key overrides it.
   */
  define(strategy: CustomValidityMergeStrategy, asDefault = false): void {
    this.set(strategy.key, strategy);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = strategy.key;
  }

  /** The key of the strategy `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a strategy by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownStrategyError` when the named (or default) strategy is absent — the registry never
   * silently substitutes a different merge math, in plugged mode exactly as in the standalone model.
   */
  resolve(key?: string): CustomValidityMergeStrategy {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownStrategyError('default', [...this.keys()]);
    const strategy = this.get(wanted as string);
    if (!strategy) throw new UnknownStrategyError(wanted, [...this.keys()]);
    return strategy;
  }
}

/** A registry pre-loaded with the two shipped strategies; source-reduction is the native-first default. */
export function createDefaultValidityMergeRegistry(): CustomValidityMergeRegistry {
  const registry = new CustomValidityMergeRegistry();
  registry.define(new SourceReductionStrategy(), true); // native-first default
  registry.define(new LastWriteWinsStrategy());
  return registry;
}
