/**
 * Injector - Abstract base class for dependency injection
 * 
 * Source: plateau/src/plugs/custom-injectors/Injector.ts
 * 
 * Manages hierarchical dependency injection with support for:
 * - Provider registration and resolution
 * - Consumable queries with path expressions
 * - Parent-child injector relationships
 * - Dynamic provider claiming/unclaiming
 * 
 * @module webinjectors
 */

import type { ProviderTypeMap, AnyProviderType } from './InjectorRoot';
import type { Registry } from './Registry';

/**
 * Global chain tracking current injection hierarchy.
 * Used during provider claims to update consumer references.
 */
let injectorChain: Injector<any, any, any>[] = [];

/**
 * Interface for providers that support querying (e.g., CustomContext).
 */
export interface Queryable {
  query(expression: string): Consumable<any>;
  unquery(consumable: Consumable<any>): void;
}

/**
 * Tracks a consumer's relationship to a provider.
 */
interface Consumer<Querier> {
  consumable: WeakRef<Consumable<any>>;
  providerType: keyof ProviderTypeMap;
  provider: AnyProviderType | null;
  injectorChain: Injector[];
  queryExpression?: string;
  querier: Querier;
}

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

  #consumers = new Set<Consumer<Querier>>();

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

    this.#parentInjector = newInjector;
  }

  /**
   * Check if a querier is valid for this injector's target.
   * Used to validate consumer-injector relationships.
   */
  abstract isQuerierValid(querier: Querier): boolean;

  /**
   * Get a provider by name.
   */
  get<Key extends keyof ProviderTypeMap>(name: Key): ProviderTypeMap[Key] | undefined {
    return this.providers.get(name) as ProviderTypeMap[Key];
  }

  /**
   * Set a provider by name.
   */
  set<Key extends keyof ProviderTypeMap>(name: Key, provider: ProviderTypeMap[Key]): this {
    this.providers.set(name, provider);
    return this;
  }

  /**
   * Remove a provider by name.
   */
  delete(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Get all provider entries.
   */
  entries() {
    return this.providers.entries();
  }

  /**
   * Get all provider values.
   */
  values() {
    return this.providers.values();
  }

  /**
   * Claim consumers for a provider.
   * 
   * When a provider is registered, this method updates all relevant consumers
   * to point to the new provider, traversing up the injector chain.
   */
  claim(provider: AnyProviderType): Consumer<Querier>[] {
    injectorChain.push(this);

    const claimedConsumers = this.#handleClaimOfOwnConsumable(provider);

    const parentClaimedConsumers: Consumer<Querier>[] = this.parentInjector 
      ? this.parentInjector.claim(provider) 
      : [];

    if (injectorChain[0] === this) {
      injectorChain = [];
      parentClaimedConsumers.forEach((consumer) => {
        this.#consumers.add(consumer);
      });
    }

    return [
      ...claimedConsumers,
      ...parentClaimedConsumers,
    ];
  }

  /**
   * Unclaim consumers for a provider.
   * Removes consumer references when a provider is unregistered.
   */
  unclaim(provider: AnyProviderType): void {
    this.#consumers.forEach((consumer) => {
      if (consumer.providerType === provider.localName) {
        this.#consumers.delete(consumer);
      }
    });
  }

  /**
   * Handle claiming of this injector's own consumers.
   */
  #handleClaimOfOwnConsumable(provider: AnyProviderType): Consumer<Querier>[] {
    const claimedConsumers: Consumer<Querier>[] = [];
    const currentInjector = injectorChain[0];

    this.#consumers.forEach((consumer) => {
      // If the injectorChain does not include injector, it means it has been invoked 
      // outside of this new provider injector.
      if (!this.isQuerierValid(consumer.querier)) return;

      const consumable = consumer.consumable.deref();
      if (!consumable) {
        // Clean collected consumables
        this.#consumers.delete(consumer);
      } else if (consumer.providerType === provider.localName) {
        // If there is no query, the consumable resolves to the provider itself.
        if (!consumable.expression) {
          consumable.provide(provider);
        } else if (this.#canProviderClaim(provider)) {
          provider.claim(consumable);
        }

        if (this.#canProviderUnclaim(consumer.provider)) {
          consumer.provider.unclaim(consumable);
        }

        // Update the query provider to the new provider
        consumer.provider = provider;
        consumer.injectorChain = injectorChain;

        if (currentInjector !== this) {
          currentInjector.unclaim(provider);
        }

        claimedConsumers.push(consumer);
      }
    });

    return claimedConsumers;
  }

  /**
   * Type guard for providers with claim capability.
   */
  #canProviderClaim(provider: AnyProviderType | null): provider is { claim: (consumable: Consumable<any>) => void } {
    return Boolean(
      provider && 'claim' in provider && typeof provider.claim === 'function',
    );
  }

  /**
   * Type guard for providers with unclaim capability.
   */
  #canProviderUnclaim(provider: AnyProviderType | null): provider is { unclaim: (consumable: Consumable<any>) => void } {
    return Boolean(
      provider && 'unclaim' in provider && typeof provider.unclaim === 'function',
    );
  }

  /**
   * Consume a provider by query string.
   * 
   * Query format: "providerName" or "providerName/path.to.value"
   * 
   * @param consumableQuery - Query string (e.g., "customContexts:nav/currentRoute")
   * @param querier - The consumer requesting the provider
   * @returns Consumable that will resolve when provider is available
   */
  consume(consumableQuery: string, querier: Querier): Consumable<any> | null {
    const [identifier, queryExpression] = consumableQuery.split('/');
    const provider = this.get(identifier);

    injectorChain.push(this);

    if (provider && 'query' in provider && typeof provider.query === 'function') {
      const query = provider.query(queryExpression);
      if (query) {
        return this.#returnConsumable(provider, identifier, querier, queryExpression, query);
      }
    } else if (provider) {
      const consumable = this.#returnConsumable(provider, identifier, querier);
      consumable.provide(provider);
      return consumable;
    }

    if (this.parentInjector) {
      const consumable = this.parentInjector.consume(consumableQuery, querier);
      if (injectorChain[0] === this) injectorChain = [];
      return consumable;
    }

    return this.#returnConsumable(null, identifier, querier, queryExpression);
  }

  /**
   * Create and track a consumable.
   */
  #returnConsumable(
    provider: AnyProviderType | null, 
    providerType: string, 
    querier: Querier, 
    queryExpression?: string, 
    consumable = new Consumable(queryExpression)
  ): Consumable<any> {
    this.#consumers.add({
      consumable: new WeakRef(consumable),
      providerType,
      provider,
      injectorChain,
      queryExpression,
      querier,
    });
    if (injectorChain[0] === this) injectorChain = [];
    return consumable;
  }
}

/**
 * TODO: Import Consumable from webstates or create placeholder.
 * For now, using a minimal interface.
 */
class Consumable<T> {
  constructor(public expression?: string) {}
  
  provide(value: T): void {
    // TODO: Implement when webstates is migrated
  }
}
