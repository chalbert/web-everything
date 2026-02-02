// Web Everything Bootstrap - Plugged Mode
// Applies all patches, exposes globals, and creates default registries
//
// Usage:
//   <script type="module" src="/plugs/bootstrap.ts"></script>
//
// After loading, you can use:
//   attributes.define('my-attr', MyAttribute);
//   stores.define('my-store', MyStore);
//   contexts.define('my-context', MyContext);
//   etc.

// Apply patches
import { applyPatches as applyWebRegistriesPatches } from './webregistries';
import { applyPatches as applyWebInjectorsPatches } from './webinjectors';
import { applyPatches as applyWebComponentsPatches } from './webcomponents';
import { applyPatches as applyWebContextsPatches } from './webcontexts';

// Import all classes
import { CustomRegistry, HTMLRegistry } from './core';
import { CustomElementRegistry } from './webregistries';
import { CustomElement } from './webcomponents';
import InjectorRoot from './webinjectors/InjectorRoot';
import HTMLInjector from './webinjectors/HTMLInjector';
import CustomContext from './webcontexts/CustomContext';
import CustomContextRegistry from './webcontexts/CustomContextRegistry';
import CustomStore from './webstates/CustomStore';
import CustomStoreRegistry from './webstates/CustomStoreRegistry';
import CustomAttribute from './webbehaviors/CustomAttribute';
import CustomAttributeRegistry from './webbehaviors/CustomAttributeRegistry';

// Extend Window interface
declare global {
  interface Window {
    WebEverything: {
      plugged: boolean;
      version: string;
    };
    // Core
    CustomRegistry: typeof CustomRegistry;
    HTMLRegistry: typeof HTMLRegistry;
    // Web Registries
    CustomElementRegistry: typeof CustomElementRegistry;
    // Web Components
    CustomElement: typeof CustomElement;
    // Web Injectors
    InjectorRoot: typeof InjectorRoot;
    HTMLInjector: typeof HTMLInjector;
    injectors: InjectorRoot;
    // Web Contexts
    CustomContext: typeof CustomContext;
    CustomContextRegistry: typeof CustomContextRegistry;
    contexts: CustomContextRegistry;
    // Web States
    CustomStore: typeof CustomStore;
    CustomStoreRegistry: typeof CustomStoreRegistry;
    stores: CustomStoreRegistry;
    // Web Behaviors
    CustomAttribute: typeof CustomAttribute;
    CustomAttributeRegistry: typeof CustomAttributeRegistry;
    attributes: CustomAttributeRegistry;
  }
}

// Apply all patches in dependency order
console.log('[Web Everything] Applying patches...');

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

// Expose classes on window
window.WebEverything = {
  plugged: true,
  version: '0.1.0',
};

// Core
window.CustomRegistry = CustomRegistry;
window.HTMLRegistry = HTMLRegistry;

// Web Registries
window.CustomElementRegistry = CustomElementRegistry;

// Web Components
window.CustomElement = CustomElement;

// Web Injectors
window.InjectorRoot = InjectorRoot;
window.HTMLInjector = HTMLInjector;

// Web Contexts
window.CustomContext = CustomContext;
window.CustomContextRegistry = CustomContextRegistry;

// Web States
window.CustomStore = CustomStore;
window.CustomStoreRegistry = CustomStoreRegistry;

// Web Behaviors
window.CustomAttribute = CustomAttribute;
window.CustomAttributeRegistry = CustomAttributeRegistry;

// Create global registry instances
console.log('[Web Everything] Creating global registries...');

// Setup injector system
const injectorRoot = new InjectorRoot();
injectorRoot.attach(document);
window.injectors = injectorRoot;

// Setup registries
window.contexts = new CustomContextRegistry();
window.stores = new CustomStoreRegistry();
window.attributes = new CustomAttributeRegistry();

console.log('[Web Everything] Bootstrap complete');
console.log('[Web Everything] Globals available: injectors, contexts, stores, attributes');
