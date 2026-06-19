/**
 * @file CustomChangeStrategyRegistry.ts
 * @description Per-scope selection of a {@link CustomChangeStrategy} (#1107, webstates completion #1089).
 *
 * Spec: `we:src/_includes/project-webstates.njk` (§"Per-Scope Selection"). Strategies register in a
 * `CustomChangeStrategyRegistry` resolved through the injector chain, so the *active* change-detection
 * mechanism is a **scope decision** — a form subtree can track on `snapshot-diff` while a collaborative
 * subtree tracks on `crdt`, in the same app, simultaneously. `active()` returns the nearest-scope strategy
 * (own selection wins, else the nearest parent scope's, else the native-first baseline); `observe()` is the
 * helper a conformant store calls so it never hard-codes detection.
 *
 * Base note: this is a **value-keyed** registry (it registers strategy *instances* keyed by their `.key`),
 * so it extends `CustomRegistry` directly — the same base `CustomGuardRegistry` /
 * `CustomValidityMergeRegistry` / `CustomValidatorResolutionRegistry` use — NOT `HTMLRegistry` (whose
 * constructor bimap is for DOM-node *classes*; a strategy instance has no constructor to key on). Scope
 * nesting is the `extends` chain, exactly like `customGuards` / `customStores`.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CustomChangeStrategy,
  type ChangeRecord,
  type Disposable,
  nativeChangeStrategy,
} from './CustomChangeStrategy';

/** Construction options — the parent scopes this registry inherits an active strategy from. */
export interface CustomChangeStrategyRegistryOptions {
  /** Enclosing-scope registries; a key (or the active strategy) this one lacks resolves up this chain. */
  extends?: CustomChangeStrategyRegistry[];
}

/**
 * The live registry of named change-detection strategies, resolved nearest-scope-wins through the injector
 * chain. Adds `define(strategy, asActive?)` / `active()` / `observe(...)` over the core registry.
 */
export default class CustomChangeStrategyRegistry extends CustomRegistry<CustomChangeStrategy> {
  localName = 'customChangeStrategy';

  /** The key of this scope's own active strategy, or null to inherit the nearest parent scope's. */
  #activeKey: string | null = null;

  /** The enclosing scopes, captured so `active()` can walk them (the core base keeps `extends` private). */
  #scopeParents: CustomChangeStrategyRegistry[];

  constructor(options: CustomChangeStrategyRegistryOptions = {}) {
    super(options);
    this.#scopeParents = options.extends ?? [];
  }

  /**
   * Register a strategy under its own `key`. The first registered — or one passed `asActive` — becomes
   * this scope's active strategy. Re-registering a key overrides it.
   */
  define(strategy: CustomChangeStrategy, asActive = false): void {
    this.set(strategy.key, strategy);
    if (asActive || this.#activeKey === null) this.#activeKey = strategy.key;
  }

  /** Select an already-registered (here or up-scope) strategy as this scope's active one. */
  setActive(key: string): void {
    this.#activeKey = key;
  }

  /** The key this scope's `active()` resolves to without walking parents, or null when it inherits. */
  get activeKey(): string | null {
    return this.#activeKey;
  }

  /**
   * The nearest-scope active strategy: this scope's own selection if set and resolvable here, else the
   * nearest enclosing scope's `active()`, else the native-first baseline (`native-signals`). Always
   * returns a usable strategy so a conformant store can `observe()` with zero configuration.
   */
  active(): CustomChangeStrategy {
    if (this.#activeKey !== null) {
      const own = this.getOwn(this.#activeKey);
      if (own) return own;
    }
    for (const parent of this.#scopeParents) {
      const inherited = parent.active();
      if (inherited) return inherited;
    }
    return nativeChangeStrategy;
  }

  /**
   * The conformant-store helper: track `target` under the nearest-scope active strategy. A store calls
   * this instead of hard-coding a detection mechanism, so the strategy stays a scope decision.
   */
  observe(target: object, onChange: (record: ChangeRecord) => void): Disposable {
    return this.active().track(target, onChange);
  }
}

/** A registry pre-loaded with the native-first change strategy as its active selection. */
export function createDefaultChangeStrategyRegistry(): CustomChangeStrategyRegistry {
  const registry = new CustomChangeStrategyRegistry();
  registry.define(nativeChangeStrategy, true);
  return registry;
}
