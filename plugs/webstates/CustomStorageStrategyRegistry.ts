/**
 * @file CustomStorageStrategyRegistry.ts
 * @description Per-scope selection + built-in degradation for {@link CustomStorageStrategy} (#1108,
 * webstates completion #1089).
 *
 * Spec: `we:src/_includes/project-webstates.njk` (§"Per-Scope Selection & Degradation"). Storage
 * strategies register in a `CustomStorageStrategyRegistry` resolved through the injector chain, so the
 * active engine is a **scope decision** (a collaborative subtree on OPFS/SQLite while a settings scope is
 * on `localStorage`, same app). `active()` returns the nearest-scope strategy (default: native IndexedDB);
 * and the registry carries the **built-in degradation chain IndexedDB → localStorage** — an operation that
 * throws on the active engine transparently falls to the next available one, the same most-available-default
 * doctrine the rest of the platform uses.
 *
 * Value-keyed like {@link ./CustomChangeStrategyRegistry} and `CustomGuardRegistry` — extends
 * `CustomRegistry` (a strategy *instance* keyed by its `.key`), NOT `HTMLRegistry`. Scope nesting is the
 * `extends` chain.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CustomStorageStrategy,
  type StorageBulkOp,
  IndexedDBStrategy,
  LocalStorageStrategy,
} from './CustomStorageStrategy';

/** Construction options — the parent scopes this registry inherits an active strategy from. */
export interface CustomStorageStrategyRegistryOptions {
  extends?: CustomStorageStrategyRegistry[];
}

/**
 * The live registry of named storage strategies, resolved nearest-scope-wins, with a per-scope degradation
 * chain. Adds `define(strategy, asActive?)` / `active()` and the degrading CRUD surface
 * (`get`/`set`/`delete`/`keys`/`bulk`) a conformant store calls instead of touching an engine directly.
 */
export default class CustomStorageStrategyRegistry<T = unknown> extends CustomRegistry<CustomStorageStrategy<T>> {
  localName = 'customStorageStrategy';

  #activeKey: string | null = null;
  #scopeParents: CustomStorageStrategyRegistry<T>[];
  /** Degradation order (strategy keys), in preference order — `define` appends, active is tried first. */
  #chain: string[] = [];

  constructor(options: CustomStorageStrategyRegistryOptions = {}) {
    super(options);
    this.#scopeParents = (options.extends as CustomStorageStrategyRegistry<T>[]) ?? [];
  }

  /**
   * Register a strategy under its own `key` and append it to the degradation chain. The first registered —
   * or one passed `asActive` — becomes this scope's active (most-preferred) engine.
   */
  define(strategy: CustomStorageStrategy<T>, asActive = false): void {
    this.set(strategy.key, strategy);
    if (!this.#chain.includes(strategy.key)) this.#chain.push(strategy.key);
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
   * The nearest-scope active strategy: this scope's own selection if registered here, else the nearest
   * enclosing scope's `active()`, else the first strategy in this scope's degradation chain. Throws only
   * when no strategy is registered anywhere up the chain.
   */
  active(): CustomStorageStrategy<T> {
    if (this.#activeKey !== null) {
      const own = this.getOwn(this.#activeKey);
      if (own) return own;
    }
    for (const parent of this.#scopeParents) {
      try {
        return parent.active();
      } catch {
        /* try the next parent scope */
      }
    }
    const head = this.#chain.map((k) => this.getOwn(k)).find(Boolean);
    if (head) return head;
    throw new Error('CustomStorageStrategyRegistry: no storage strategy registered');
  }

  /** The degradation order for an operation: the active engine first, then the rest of the chain. */
  #degradationOrder(): CustomStorageStrategy<T>[] {
    const keys = this.#activeKey ? [this.#activeKey, ...this.#chain.filter((k) => k !== this.#activeKey)] : [...this.#chain];
    return keys.map((k) => this.get(k)).filter((s): s is CustomStorageStrategy<T> => !!s);
  }

  /**
   * Run a storage operation against the degradation chain: try the active engine, and on a thrown error
   * fall through to each remaining strategy (IndexedDB → localStorage) until one succeeds. Rethrows the
   * last error only when every strategy failed (or none is registered).
   */
  async run<R>(operation: (strategy: CustomStorageStrategy<T>) => Promise<R>): Promise<R> {
    const chain = this.#degradationOrder();
    if (!chain.length) throw new Error('CustomStorageStrategyRegistry: no storage strategy registered');
    let lastError: unknown;
    for (const strategy of chain) {
      try {
        return await operation(strategy);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  // ── Degrading CRUD surface — what a conformant store calls ───────────────────────────────────────────
  // Distinct names (read/persist/remove/listKeys/bulkWrite) so they don't shadow the inherited registry
  // map API (get/set/delete/keys), which manages REGISTRATION; these manage stored DATA through the chain.
  read(scope: string, id: string): Promise<T | undefined> {
    return this.run((s) => s.get(scope, id));
  }
  persist(scope: string, id: string, value: T): Promise<void> {
    return this.run((s) => s.set(scope, id, value));
  }
  remove(scope: string, id: string): Promise<void> {
    return this.run((s) => s.delete(scope, id));
  }
  listKeys(scope: string): Promise<string[]> {
    return this.run((s) => s.keys(scope));
  }
  bulkWrite(scope: string, ops: StorageBulkOp<T>[]): Promise<void> {
    return this.run((s) => (s.bulk ? s.bulk(scope, ops) : defaultBulk(s, scope, ops)));
  }
}

/** Fallback bulk for an engine without native `bulk` — sequential set/delete (mirrors LocalStorageStrategy). */
async function defaultBulk<T>(s: CustomStorageStrategy<T>, scope: string, ops: StorageBulkOp<T>[]): Promise<void> {
  for (const op of ops) {
    if (op.op === 'set') await s.set(scope, op.id, op.value);
    else await s.delete(scope, op.id);
  }
}

/**
 * A registry pre-loaded with the native-first degradation chain: IndexedDB (when the platform provides it)
 * as the active engine, then the localStorage degradation floor. In an environment without IndexedDB the
 * floor is registered first and becomes active — transparent degradation with no caller change.
 */
export function createDefaultStorageStrategyRegistry<T = unknown>(): CustomStorageStrategyRegistry<T> {
  const registry = new CustomStorageStrategyRegistry<T>();
  if (typeof indexedDB !== 'undefined') registry.define(new IndexedDBStrategy<T>(), true);
  registry.define(new LocalStorageStrategy<T>());
  return registry;
}
