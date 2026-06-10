/**
 * Runtime `customValidatorResolution` plug (#224) — the live counterpart to the dependency-free
 * `validator-resolution/` model shipped by #214, and the async sibling of #215's
 * `CustomValidityMergeRegistry`.
 *
 * Where the standalone model is a self-contained table, this is the **real plug**: a
 * `CustomRegistry<CustomValidatorResolution>` (the same base every Web Everything registry extends) so
 * it participates in the injector chain — a scope sets one on its injector and controls below resolve
 * it nearest-scope-wins (#207 D6), exactly like `customValidityMerge` / `customStores`. It reuses the
 * resolution strategies and async runner from the `validator-resolution/` model verbatim — only the
 * registry differs (core `CustomRegistry` here vs the standalone table there), so the stale-answer
 * policy has one home and cannot drift.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CustomValidatorResolution,
  VersioningResolution,
  CancellationResolution,
} from '../../validator-resolution/provider.js';
import { UnknownResolutionError } from '../../validator-resolution/registry.js';

/**
 * The live registry of named resolution strategies. Extends the core `CustomRegistry` (keyed by
 * strategy name) so it is injector-chain-resolvable and inheritable via `extends`; adds the
 * validator-resolution `define(strategy, asDefault?)` / `resolve(key?)` surface the standalone model
 * documents, deriving the registration key from the strategy's own `key` rather than a hand-passed name.
 */
export default class CustomValidatorResolutionRegistry extends CustomRegistry<CustomValidatorResolution> {
  localName = 'customValidatorResolution';
  #defaultKey: string | null = null;

  /**
   * Register a strategy under its own `key`. The first registered — or one passed `asDefault` —
   * becomes the strategy a control uses when its scope names none (the native-first versioning, by
   * convention). Re-registering a key overrides it.
   */
  define(strategy: CustomValidatorResolution, asDefault = false): void {
    this.set(strategy.key, strategy);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = strategy.key;
  }

  /** The key of the strategy `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a strategy by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownResolutionError` when the named (or default) strategy is absent — the registry never
   * silently substitutes a different policy, in plugged mode exactly as in the standalone model.
   */
  resolve(key?: string): CustomValidatorResolution {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownResolutionError('default', [...this.keys()]);
    const strategy = this.get(wanted as string);
    if (!strategy) throw new UnknownResolutionError(wanted, [...this.keys()]);
    return strategy;
  }
}

/** A registry pre-loaded with the two shipped strategies; versioning is the native-first default. */
export function createDefaultValidatorResolutionRegistry(): CustomValidatorResolutionRegistry {
  const registry = new CustomValidatorResolutionRegistry();
  registry.define(new VersioningResolution(), true); // native-first default
  registry.define(new CancellationResolution());
  return registry;
}
