// Web Everything Plugs - Unplugged Mode (Clean Exports)
//
// This module provides clean exports without side effects.
// For "plugged mode" with patches and globals, use bootstrap.ts instead.
//
// Usage:
//   import { register, upgrade, CustomAttribute } from '@webeverything/plugs';
//
//   const attributes = new CustomAttributeRegistry();
//   attributes.define('tooltip', TooltipAttribute);
//   register(attributes);
//   upgrade(document);

// Unplugged API - functional interface for registering and upgrading plugs
export {
  register,
  unregister,
  upgrade,
  downgrade,
  attach,
  detach,
  getPlug,
  hasPlug,
  getPlugs,
  getPlugNames,
  getRoots,
  isUpgraded,
  reset,
} from './unplugged';

// Core exports
export { CustomRegistry } from './core';
export { HTMLRegistry } from './core';
export type { Plug } from './core';
export { isPlug } from './core';

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
