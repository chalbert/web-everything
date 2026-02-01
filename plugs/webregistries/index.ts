// Web Registries - Scoped Custom Element Registry
// Supports both "plugged" (patches global) and "unplugged" (library) modes

export { default as CustomElementRegistry } from './CustomElementRegistry';
export type { 
  CustomElementRegistryOptions,
  ElementDefinition,
  ImplementedElement 
} from './CustomElementRegistry';

/**
 * Apply patches to the global window.customElements.
 * 
 * "Plugged Mode": Replaces the native CustomElementRegistry with our scoped version.
 * 
 * ⚠️ WARNING: This mutates global objects and cannot be easily undone.
 * Only call this once at application startup.
 * 
 * @example
 * import { applyPatches } from '@web-registries';
 * applyPatches();
 */
export function applyPatches(): void {
  // TODO: Implement global patching
  // This will replace window.CustomElementRegistry and window.customElements
  // with our scoped versions that support registry hierarchies
  
  console.warn('applyPatches() not yet implemented for webregistries');
  
  // Planned implementation:
  // 1. Save original CustomElementRegistry
  // 2. Define new window.CustomElementRegistry = CustomElementRegistry
  // 3. Create root registry: window.customElements = new CustomElementRegistry()
  // 4. Patch Element.prototype.attachShadow to support scoped registries
}

/**
 * Remove patches and restore native CustomElementRegistry.
 * 
 * ⚠️ WARNING: This may break existing custom elements that depend on scoped registries.
 * Only use this for testing or development.
 * 
 * @example
 * import { removePatches } from '@web-registries';
 * removePatches();
 */
export function removePatches(): void {
  // TODO: Implement patch removal
  console.warn('removePatches() not yet implemented for webregistries');
  
  // Planned implementation:
  // 1. Restore original window.CustomElementRegistry
  // 2. Restore original window.customElements
  // 3. Remove attachShadow patch
}

/**
 * Check if patches are currently applied.
 * 
 * @returns true if global patches are active
 */
export function isPatched(): boolean {
  // TODO: Implement patch detection
  return false;
}
