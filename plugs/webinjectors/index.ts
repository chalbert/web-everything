/**
 * webinjectors - Hierarchical Dependency Injection for the DOM
 * 
 * Provides plugged/unplugged access to the Web Injectors system.
 * 
 * @module webinjectors
 */

export { default as InjectorRoot, type InjectorRootOptions, type ProviderDefinition, type ProviderTypeMap, type AnyProviderType } from './InjectorRoot';
export { default as HTMLInjector, type HTMLInjectorTarget, type HTMLProviderType } from './HTMLInjector';
export { default as Injector, type Queryable } from './Injector';
export { default as HTMLRegistry, type BaseDefinition, type ConstructorDefinition } from './HTMLRegistry';
export { type Registry } from './Registry';
export { applyNodeInjectorsPatches, removeNodeInjectorsPatches, isNodeInjectorsPatched } from './Node.injectors.patch';

/**
 * Apply webinjectors patches to native DOM APIs.
 * 
 * This mutates:
 * - Node.prototype: Adds injectors(), getClosestInjector(), getOwnInjector(), hasOwnInjector()
 * - Window/Document: Adds customProviders property
 * - ShadowRoot.prototype: Adds customProviders property
 * 
 * WARNING: Global mutation - use with caution.
 */
export function applyPatches(): void {
  if (isPatched()) {
    console.warn('webinjectors patches already applied');
    return;
  }

  applyNodeInjectorsPatches();
  
  // TODO: Apply customProviders property patches to Window/Document/ShadowRoot
  // This will require creating InjectorRoot instances and attaching them
  
  console.log('webinjectors patches applied');
}

/**
 * Remove webinjectors patches from native DOM APIs.
 * 
 * Attempts to restore original behavior. May not be fully reversible
 * if other code has captured references to patched methods.
 */
export function removePatches(): void {
  if (!isPatched()) {
    console.warn('webinjectors patches not applied');
    return;
  }

  removeNodeInjectorsPatches();
  
  // TODO: Remove customProviders properties
  
  console.log('webinjectors patches removed');
}

/**
 * Check if webinjectors patches are currently applied.
 */
export function isPatched(): boolean {
  return isNodeInjectorsPatched();
}
