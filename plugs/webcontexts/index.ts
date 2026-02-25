/**
 * @file webcontexts/index.ts
 * @description Web Contexts - Custom context system with hierarchical state management
 * @source Migrated from plateau/src/plugs/custom-contexts/
 */

import {
  applyNodeContextsPatch as _applyNodeContextsPatch,
  removeNodeContextsPatch as _removeNodeContextsPatch,
  isContextsPatchApplied as _isContextsPatchApplied,
} from './Node.contexts.patch';

export { default as CustomContext } from './CustomContext';
export { default as CustomContextRegistry } from './CustomContextRegistry';
export type { ImplementedContext, ContextSubscription, ContextSubscriptionHandle } from './CustomContext';
export type { ContextDefinition } from './CustomContextRegistry';

export {
  applyNodeContextsPatch,
  removeNodeContextsPatch,
  isContextsPatchApplied,
} from './Node.contexts.patch';

/**
 * Apply all webcontexts patches
 */
export function applyPatches(): void {
  _applyNodeContextsPatch();
}

/**
 * Remove all webcontexts patches
 */
export function removePatches(): void {
  _removeNodeContextsPatch();
}

/**
 * Check if all webcontexts patches are applied
 */
export function isPatched(): boolean {
  return _isContextsPatchApplied();
}
