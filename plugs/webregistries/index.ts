// Web Registries - Scoped Custom Element Registry
// Supports both "plugged" (patches global) and "unplugged" (library) modes

export { default as CustomElementRegistry } from './CustomElementRegistry';
export type {
  CustomElementRegistryOptions,
  ElementDefinition,
  ImplementedElement
} from './CustomElementRegistry';

// Declarative `<script type="registry">` scoped-registration binding (#901, implements #854): the
// Tier-1.5 declared-registry form + the `registry="<id>"` association (#900) + the MOMENT-2 binding
// behavior. The runtime, no-build twin of `<script type="injector">` (#278).
export {
  applyDeclarativeRegistries,
  parseRegistryScript,
  resolveScopedRegistry,
  flushPendingDefinitions,
  applyScopedRegistryToHost,
  getScopedRegistryOf,
  getActiveRegistryResult,
  resetDeclaredRegistries,
  RegistryScriptError,
  REGISTRY_SCRIPT_TYPE,
  REGISTRY_ASSOC_ATTR,
  SCOPED_REGISTRY_KEY,
  type CtorResolver,
  type DeclarativeRegistryOptions,
  type RegistryScriptDeclaration,
  type RegistryScriptBinding,
  type PendingDefinition,
  type DeclarativeRegistryResult,
} from './declarativeRegistry';
export { default as ScopedRegistryAttribute } from './ScopedRegistryAttribute';

import CustomElementRegistryImpl from './CustomElementRegistry';
import { applyScopedRegistryToHost, SCOPED_REGISTRY_KEY } from './declarativeRegistry';

// ── Plugged-mode global patching (#1100, slice A of #1088) ──────────────────────────────────────────────
// State for the global swap so removePatches() restores exactly what applyPatches() replaced. Mirrors the
// _patchApplied/save-restore shape of the sibling Node patches (webinjectors/webcomponents/webcontexts).
let _patched = false;
let _originalRegistry: typeof window.CustomElementRegistry | undefined;
let _originalCustomElements: typeof window.customElements | undefined;
let _originalAttachShadow: typeof Element.prototype.attachShadow | undefined;

/** A scoped-registry option carried on `attachShadow` init (the `customElementRegistry` proposal + aliases). */
type ScopedShadowInit = ShadowRootInit & {
  customElements?: CustomElementRegistryImpl;
  registry?: CustomElementRegistryImpl;
  customElementRegistry?: CustomElementRegistryImpl;
};

/** Reassign a global property even when it is defined as a getter (e.g. `window.customElements`). */
function redefine(target: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
}

/**
 * Apply patches to the global window.customElements ("Plugged Mode"): replaces the native
 * CustomElementRegistry with the scoped version and installs a root scoped registry, and patches
 * `attachShadow` so a shadow created with a scoped registry (`attachShadow({ customElements })`)
 * associates it with the host. Idempotent — a second call warns and no-ops.
 *
 * ⚠️ Mutates globals. Intended once at application startup; `removePatches()` restores the originals.
 *
 * @example
 * import { applyPatches } from '@web-registries';
 * applyPatches();
 */
export function applyPatches(): void {
  if (_patched) {
    console.warn('webregistries patches already applied');
    return;
  }
  // 1. Save originals.
  _originalRegistry = window.CustomElementRegistry;
  _originalCustomElements = window.customElements;
  _originalAttachShadow = Element.prototype.attachShadow;

  // 2-3. Swap the global registry class + install a root scoped registry.
  redefine(window, 'CustomElementRegistry', CustomElementRegistryImpl);
  redefine(window, 'customElements', new CustomElementRegistryImpl());

  // 4. Patch attachShadow to honour a scoped-registry option, associating it with the host so
  //    getScopedRegistryOf(host) resolves it (the native `attachShadow({ customElementRegistry })` path).
  const originalAttachShadow = _originalAttachShadow;
  Element.prototype.attachShadow = function attachShadow(this: Element, init: ScopedShadowInit): ShadowRoot {
    const root = originalAttachShadow.call(this, init);
    const scoped = init && (init.customElements ?? init.registry ?? init.customElementRegistry);
    if (scoped) applyScopedRegistryToHost(this, scoped);
    return root;
  } as typeof Element.prototype.attachShadow;

  _patched = true;
}

/**
 * Remove patches and restore native CustomElementRegistry, the original root registry, and the native
 * `attachShadow`. Idempotent — a no-op (with a warning) when patches are not applied.
 *
 * ⚠️ May break elements depending on scoped registries; intended for testing/development.
 *
 * @example
 * import { removePatches } from '@web-registries';
 * removePatches();
 */
export function removePatches(): void {
  if (!_patched) {
    console.warn('webregistries patches not applied, nothing to remove');
    return;
  }
  redefine(window, 'CustomElementRegistry', _originalRegistry);
  redefine(window, 'customElements', _originalCustomElements);
  if (_originalAttachShadow) Element.prototype.attachShadow = _originalAttachShadow;
  _originalRegistry = undefined;
  _originalCustomElements = undefined;
  _originalAttachShadow = undefined;
  _patched = false;
}

/**
 * Check if patches are currently applied.
 *
 * @returns true if global patches are active
 */
export function isPatched(): boolean {
  return _patched;
}
