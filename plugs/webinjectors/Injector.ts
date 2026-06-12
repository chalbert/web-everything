/**
 * Injector - Abstract base class for dependency injection
 *
 * Manages hierarchical dependency injection with support for:
 * - Provider registration and resolution
 * - Lazy loading via register() + consume()
 * - Parent-child injector relationships
 *
 * consume() works like import() but resolved through DI:
 * - Provider loaded → return immediately
 * - Provider registered but not loaded → call loader, resolve when done
 * - Provider unknown → throw
 *
 * @module webinjectors
 */

import type { ProviderTypeMap } from './InjectorRoot';
import type { Registry } from './Registry';

/**
 * Abstract base class for hierarchical dependency injection.
 *
 * @template ProviderType - Type of providers managed by this injector
 * @template Target - Type of target this injector is attached to
 * @template Querier - Type of consumers that can query this injector
 */
export default abstract class Injector<
  ProviderType extends Registry<any, any> = Registry<{}>,
  Target = null,
  Querier = null
> {
  protected providers = new Map<keyof ProviderTypeMap, ProviderTypeMap[keyof ProviderTypeMap]>();

  /** Lazy loaders: key → function that returns a Promise of the provider value */
  #registry = new Map<string, () => Promise<any>>();

  /** In-flight loads: deduplicates concurrent consume() calls for the same key */
  #loading = new Map<string, Promise<any>>();

  /** Set to true after dispose() — prevents in-flight loaders from writing zombie state */
  #disposed = false;

  /**
   * Consumption-edge introspection (#400, the empirical prerequisite for the #092 provider↔consumer
   * graph). The provider side is already introspectable (`entries()`, `keys()`, the injector tree,
   * the registries); the *consumer* side was not — `consume()` carried the querier purely to
   * validate it, then dropped it, so no "X consumes @y" edge existed. With tracking enabled, each
   * resolved `consume(name, querier)` records a `(provider ← querier)` edge here, the `consumesApis`-
   * equivalent the graph build reads.
   *
   * **Opt-in and off by default** (`Injector.trackConsumption = false`) so production runtime is
   * untouched: a graph/build tool flips it on, exercises the app, then reads {@link consumptionEdges}.
   * It holds strong references to queriers, so it is a build-time / dev introspection aid, not a
   * long-lived production recorder. The #092 ruling keeps the autonomous runtime agent deferred; this
   * is only the introspection surface that makes edges *readable*, with edges "potential until
   * trace-confirmed" exactly as that ruling frames them.
   */
  static trackConsumption = false;

  /** provider key → the set of queriers observed consuming it (when tracking is enabled). */
  #consumptionEdges = new Map<string, Set<Querier>>();

  // Child injectors in the hierarchy
  childInjectors = new Set<Injector<ProviderType, Target, Querier>>();

  #parentInjector: Injector<ProviderType, Target, Querier> | null = null;

  constructor(
    public target: Target,
    parentInjector: Injector<ProviderType, Target, Querier> | null = null,
  ) {
    if (!target) {
      throw new Error('Injector target must be provided');
    }

    this.parentInjector = parentInjector;

    if (parentInjector) {
      parentInjector.childInjectors.add(this);
    }
  }

  get parentInjector() {
    return this.#parentInjector;
  }

  set parentInjector(newInjector: Injector<ProviderType, Target, Querier> | null) {
    if (newInjector === this) {
      throw new Error('Cannot set itself as own parent');
    }

    // Remove from old parent's children
    if (this.#parentInjector) {
      this.#parentInjector.childInjectors.delete(this);
    }

    this.#parentInjector = newInjector;

    // Add to new parent's children
    if (newInjector) {
      newInjector.childInjectors.add(this);
    }
  }

  /**
   * Check if a querier is valid for this injector's target.
   * Used to validate consumer-injector relationships.
   */
  abstract isQuerierValid(querier: Querier): boolean;

  /**
   * Get a provider by name (synchronous, loaded providers only).
   */
  get<Key extends keyof ProviderTypeMap>(name: Key): ProviderTypeMap[Key] | undefined {
    return this.providers.get(name) as ProviderTypeMap[Key];
  }

  /**
   * Set a provider by name (eagerly — acts as register + load in one step).
   * Clears any pending lazy registration for this key.
   */
  set<Key extends keyof ProviderTypeMap>(name: Key, provider: ProviderTypeMap[Key]): this {
    const key = name as string;
    this.providers.set(name, provider);
    this.#registry.delete(key);
    this.#loading.delete(key);
    return this;
  }

  /**
   * Remove a provider by name from all maps.
   */
  delete(name: string): boolean {
    this.#registry.delete(name);
    this.#loading.delete(name);
    return this.providers.delete(name);
  }

  /**
   * Register a lazy-loaded provider.
   * The loader is called on first consume() and its result is cached.
   *
   * @param name - Provider key
   * @param loader - Async function that returns the provider value
   */
  register<Key extends keyof ProviderTypeMap>(
    name: Key,
    loader: () => Promise<ProviderTypeMap[Key]>,
  ): this {
    this.#registry.set(name as string, loader);
    return this;
  }

  /**
   * Get all provider entries.
   */
  entries() {
    return this.providers.entries();
  }

  /**
   * The consumer→provider edges this injector observed (#400) — the `consumesApis`-equivalent the
   * #092 graph build reads, as `{ provider, querier }` pairs. Empty unless
   * {@link Injector.trackConsumption} was enabled before the `consume()` calls. Edges are recorded
   * at the injector where `consume()` was invoked; a graph builder walks {@link childInjectors} /
   * {@link parentInjector} and dedups across the tree.
   */
  consumptionEdges(): { provider: string; querier: Querier }[] {
    const edges: { provider: string; querier: Querier }[] = [];
    for (const [provider, queriers] of this.#consumptionEdges) {
      for (const querier of queriers) edges.push({ provider, querier });
    }
    return edges;
  }

  /**
   * Get all provider values.
   */
  values() {
    return this.providers.values();
  }

  /**
   * Consume a provider by name.
   *
   * Works like import() but resolved through the injector hierarchy:
   * 1. Already loaded (in providers) → return immediately
   * 2. Registered but not loaded (in #registry) → call loader, cache, return
   * 3. Parent exists → delegate up the chain
   * 4. Unknown → throw
   *
   * @param name - Provider key (e.g., "customContexts:config")
   * @param querier - The consumer requesting the provider
   * @returns The provider value
   * @throws Error if provider is not registered anywhere in the chain
   */
  async consume<Key extends keyof ProviderTypeMap>(
    name: Key,
    querier: Querier,
  ): Promise<ProviderTypeMap[Key]> {
    const key = name as string;

    // #400 — record the consumer→provider edge at the seam where consumption actually happens.
    // Off by default (zero cost in production); enabled by a graph/build tool to harvest edges.
    if (Injector.trackConsumption && querier != null) {
      let consumers = this.#consumptionEdges.get(key);
      if (!consumers) this.#consumptionEdges.set(key, (consumers = new Set<Querier>()));
      consumers.add(querier);
    }

    // State 3: Already loaded
    const existing = this.providers.get(name);
    if (existing !== undefined) {
      return existing as ProviderTypeMap[Key];
    }

    // State 2: Registered but not loaded — trigger lazy load
    const loader = this.#registry.get(key);
    if (loader) {
      // Dedup concurrent loads for the same key.
      // Store deferred promise BEFORE calling loader() so that synchronous
      // re-entry (circular deps) finds the in-flight promise instead of
      // re-calling the loader — matching ES module import() semantics.
      if (!this.#loading.has(key)) {
        let resolveLoad!: (value: any) => void;
        let rejectLoad!: (reason: any) => void;
        const deferred = new Promise<any>((res, rej) => {
          resolveLoad = res;
          rejectLoad = rej;
        });
        this.#loading.set(key, deferred);

        loader().then(
          (value) => {
            // Only write if this load is still current (not superseded by set/delete/dispose)
            if (this.#loading.get(key) === deferred && !this.#disposed) {
              this.providers.set(name, value);
              this.#registry.delete(key);
              this.#loading.delete(key);
            }
            resolveLoad(value);
          },
          (error) => {
            if (this.#loading.get(key) === deferred) {
              this.#loading.delete(key);
            }
            rejectLoad(error);
          },
        );
      }
      return this.#loading.get(key)! as Promise<ProviderTypeMap[Key]>;
    }

    // Walk parent chain
    if (this.parentInjector) {
      return this.parentInjector.consume(name, querier);
    }

    // State 1: Unknown provider
    throw new Error(`Unknown provider: ${key}`);
  }

  /**
   * Dispose this injector — clears all state and disconnects from parent.
   */
  dispose(): void {
    this.#disposed = true;
    this.providers.clear();
    this.#registry.clear();
    this.#loading.clear();
    this.#consumptionEdges.clear();

    if (this.parentInjector) {
      this.parentInjector.childInjectors.delete(this);
    }
  }
}
