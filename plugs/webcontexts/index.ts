/**
 * @file webcontexts/index.ts
 * @description Web Contexts - Custom context system with hierarchical state management
 * @source Migrated from plateau/src/plugs/custom-contexts/
 */

export { default as CustomContext } from './CustomContext';
export { default as CustomContextRegistry } from './CustomContextRegistry';
export type { ImplementedContext, Consumable } from './CustomContext';
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
  const { applyNodeContextsPatch } = require('./Node.contexts.patch');
  applyNodeContextsPatch();
}

/**
 * Remove all webcontexts patches
 */
export function removePatches(): void {
  const { removeNodeContextsPatch } = require('./Node.contexts.patch');
  removeNodeContextsPatch();
}

/**
 * Check if all webcontexts patches are applied
 */
export function isPatched(): boolean {
  const { isContextsPatchApplied } = require('./Node.contexts.patch');
  return isContextsPatchApplied();
}
