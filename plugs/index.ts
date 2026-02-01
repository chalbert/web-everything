// Web Everything Plugs - All-in-one entry point
// "Plugged Mode": Applies all patches to native browser APIs

/**
 * Apply all Web Everything patches to the browser.
 * 
 * This is the "all-in-one" plugged mode that activates all polyfills.
 * 
 * ⚠️ WARNING: This mutates native browser APIs globally.
 * Call this once at application startup.
 * 
 * @example
 * import '@web-everything/plugs';
 * // All patches are now active
 */

// Phase 2: webregistries ⚠️ Partially implemented
import { applyPatches as applyWebRegistriesPatches } from './webregistries';

// Phase 3: webinjectors ✅ Implemented
import { applyPatches as applyWebInjectorsPatches } from './webinjectors';

// Phase 4: webcomponents ⚠️ Partially implemented
import { applyPatches as applyWebComponentsPatches } from './webcomponents';

// Phase 5: webcontexts ✅ Implemented
import { applyPatches as applyWebContextsPatches } from './webcontexts';

// Apply all patches in dependency order
console.log('[Web Everything] Applying plugs...');

try {
  applyWebRegistriesPatches();
  console.log('[Web Everything] ✅ webregistries patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webregistries patches:', error);
}

try {
  applyWebInjectorsPatches();
  console.log('[Web Everything] ✅ webinjectors patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webinjectors patches:', error);
}

try {
  applyWebComponentsPatches();
  console.log('[Web Everything] ✅ webcomponents patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webcomponents patches:', error);
}

try {
  applyWebContextsPatches();
  console.log('[Web Everything] ✅ webcontexts patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webcontexts patches:', error);
}

console.log('[Web Everything] Plugs initialization complete');

export { CustomElementRegistry } from './webregistries';
export { CustomElement } from './webcomponents';
export { CustomRegistry } from './core';
export { HTMLRegistry } from './core';
