/**
 * @file blocks/renderers/auto-define/index.ts
 * @description Auto-Define contract + native-first `explicit` baseline + the `defineElement` helper
 *              (#241), plus the open registry, the platform-config flavors, and the inferring
 *              strategies — lazy-dom (DOM-presence) + build-parsed (#242).
 *              Spec: /projects/webcomponents/#protocol-auto-define-strategy
 */

export { defineElement, explicitAutoDefine } from './defineElement';
export type {
  AutoDefineStrategy,
  AutoDefineTrigger,
  RegistryScope,
  DefiningModule,
} from './defineElement';

// Open registry + platform-config flavors (#242) — config-extends-platform default, no tool-baked default.
export {
  default as CustomAutoDefineRegistry,
  UnknownAutoDefineError,
  createStrictExplicitFlavor,
  createLazyDomFlavor,
  createBuildParsedFlavor,
  AUTO_DEFINE_FLAVORS,
  type AutoDefineFlavorName,
} from './CustomAutoDefineRegistry';

// Inferring strategies (#242).
export {
  lazyDomAutoDefine,
  createLazyDomAutoDefine,
  createDomPresenceObserver,
  conventionResolver,
  type LazyDomOptions,
  type TagResolver,
  type DomPresenceObserverOptions,
} from './lazyDomStrategy';
export {
  buildParsedAutoDefine,
  createBuildParsedAutoDefine,
  type BuildManifest,
} from './buildParsedStrategy';
