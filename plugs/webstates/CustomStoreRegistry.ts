/**
 * @file CustomStoreRegistry.ts
 * @description Registry for managing custom store types
 * @source Migrated from plateau/src/plugs/custom-stores/CustomStoreRegistry.ts
 */

import HTMLRegistry, {
  type ConstructorDefinition,
} from '../webinjectors/HTMLRegistry';
import type { ImplementedStore } from './CustomStore';

/**
 * Options for defining a custom store
 */
export interface CustomStoreRegistryOptions {
  /**
   * Registries to extend/inherit from
   */
  extends?: CustomStoreRegistry[];
  
  /**
   * Context types associated with this store
   * Used for scoping store instances to specific contexts
   */
  contextTypes?: string[];
}

/**
 * Definition of a registered store type
 */
export interface StoreDefinition
  extends ConstructorDefinition<ImplementedStore<any>> {
  /**
   * Store constructor function
   */
  constructor: ImplementedStore<any>;
  
  /**
   * Context types this store is associated with
   */
  contextTypes: string[];
}

/**
 * Registry for managing custom store types
 * 
 * CustomStoreRegistry provides a centralized registry for store constructors,
 * enabling dependency injection and type-safe store access. Stores can be
 * associated with specific context types for scoped state management.
 * 
 * @example
 * ```typescript
 * const registry = new CustomStoreRegistry();
 * 
 * registry.define('app', AppStore, {
 *   contextTypes: ['application']
 * });
 * 
 * registry.define('user', UserStore, {
 *   contextTypes: ['user', 'session']
 * });
 * 
 * const AppStoreConstructor = registry.get('app');
 * const store = new AppStoreConstructor();
 * ```
 */
export default class CustomStoreRegistry extends HTMLRegistry<
  StoreDefinition,
  ImplementedStore<any>
> {
  /**
   * Local name for this registry type
   */
  localName = 'customStores';

  /**
   * Define a new store type
   * 
   * @param name - Unique identifier for the store
   * @param Store - Store constructor
   * @param options - Registration options
   */
  define(
    name: string,
    Store: ImplementedStore<any>,
    { contextTypes = [] }: CustomStoreRegistryOptions = {}
  ): void {
    const definition: StoreDefinition = {
      constructor: Store,
      contextTypes,
    };
    this.set(name, definition);
  }

  /**
   * Activate the registry (no-op for stores)
   * Stores don't require DOM observation like elements or attributes
   */
  upgrade(): void {
    // No-op: stores don't need DOM observation
  }

  /**
   * Deactivate the registry (no-op for stores)
   * Stores don't require DOM observation cleanup
   */
  downgrade(): void {
    // No-op: stores don't need DOM observation cleanup
  }
}
