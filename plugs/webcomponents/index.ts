// Web Components - Enhanced Custom Elements with Options Support

/**
 * webcomponents - Enhanced Custom Elements
 * 
 * Provides plugged/unplugged access to the Web Components enhancements.
 * 
 * @module webcomponents
 */

export { default as CustomElement } from './CustomElement';
export { applyCloneNodePatch, removeCloneNodePatch, isCloneNodePatched } from './Node.cloneNode.patch';
export { patch as applyInsertionPatch, removePatch as removeInsertionPatch } from './Element.insertion.patch';
export { registerCloneHandlers, unregisterCloneHandlers } from './cloneHandlers';

/**
 * Apply webcomponents patches to native DOM APIs.
 * 
 * This mutates:
 * - Node.prototype.cloneNode: Enhanced cloning for custom elements
 * - Node.prototype.determined: Property to check if element is determined
 * - Element.prototype.innerHTML: Tracks creation injector during HTML parsing
 * - Element insertion methods: append, prepend, after, before, replaceChildren, replaceWith, insertAdjacentElement
 * 
 * WARNING: Global mutation - use with caution.
 */
export function applyPatches(): void {
  if (isPatched()) {
    console.warn('webcomponents patches already applied');
    return;
  }

  registerCloneHandlers();
  applyCloneNodePatch();
  
  console.log('webcomponents patches applied');
}

/**
 * Remove webcomponents patches from native DOM APIs.
 */
export function removePatches(): void {
  if (!isPatched()) {
    console.warn('webcomponents patches not applied');
    return;
  }

  removeCloneNodePatch();
  unregisterCloneHandlers();
  
  console.log('webcomponents patches removed');
}

/**
 * Check if webcomponents patches are currently applied.
 */
export function isPatched(): boolean {
  return isCloneNodePatched();
}

export type { CustomElementOptions } from './CustomElement';
