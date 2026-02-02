// Web Everything Plugs - Unplugged Mode (Clean Exports)
//
// This module provides clean exports without side effects.
// For "plugged mode" with patches and globals, use bootstrap.ts instead.
//
// Usage:
//   import { CustomStore, CustomAttribute } from '@webeverything/plugs';

// Core exports
export { CustomRegistry } from './core';
export { HTMLRegistry } from './core';

// Web Registries
export { CustomElementRegistry } from './webregistries';

// Web Components
export { CustomElement } from './webcomponents';

// Web Injectors
export { default as InjectorRoot } from './webinjectors/InjectorRoot';
export { default as HTMLInjector } from './webinjectors/HTMLInjector';

// Web Contexts
export { default as CustomContext } from './webcontexts/CustomContext';
export { default as CustomContextRegistry } from './webcontexts/CustomContextRegistry';

// Web States
export { default as CustomStore } from './webstates/CustomStore';
export { default as CustomStoreRegistry } from './webstates/CustomStoreRegistry';

// Web Behaviors
export { default as CustomAttribute } from './webbehaviors/CustomAttribute';
export { default as CustomAttributeRegistry } from './webbehaviors/CustomAttributeRegistry';

// Patch functions (for manual application)
export { applyPatches as applyWebRegistriesPatches } from './webregistries';
export { applyPatches as applyWebInjectorsPatches } from './webinjectors';
export { applyPatches as applyWebComponentsPatches } from './webcomponents';
export { applyPatches as applyWebContextsPatches } from './webcontexts';
