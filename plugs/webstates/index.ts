/**
 * @file webstates/index.ts
 * @description Custom state stores module
 */

if (typeof window !== 'undefined') {
  console.log('[webstates] Module loaded');
}

export { default as CustomStore } from './CustomStore';
export type {
  StoreListener,
  StoreUnsubscribe,
  StoreSubscription,
  StoreOptions,
  ImplementedStore,
} from './CustomStore';

export { default as CustomStoreRegistry } from './CustomStoreRegistry';
export type {
  CustomStoreRegistryOptions,
  StoreDefinition,
} from './CustomStoreRegistry';
