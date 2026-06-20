/**
 * @file webportals/index.ts
 * @description Web Portals plug — logical-tree polyfill (foundation slice #1148 of epic #1001).
 *   Mirrors the sibling webinjectors/webcontexts plug index: an `applyPatches`/`removePatches` pair
 *   plus an `isPatched()` guard, and re-exports the unplugged-mode helpers (#606 non-invasive surface).
 *
 *   Logical event propagation (#1149) and the portal directive + outlet (#1150) build on top of the
 *   logical-parent links established here. The portal custom elements are defined via the separate
 *   (irreversible, idempotent) `definePortalElements()`, also invoked by `applyPatches()`.
 */

import {
  applyNodeLogicalPatch as _applyNodeLogicalPatch,
  removeNodeLogicalPatch as _removeNodeLogicalPatch,
  isLogicalPatchApplied as _isLogicalPatchApplied,
} from './Node.logical.patch';
import {
  applyEventLogicalPatch as _applyEventLogicalPatch,
  removeEventLogicalPatch as _removeEventLogicalPatch,
  isEventLogicalPatchApplied as _isEventLogicalPatchApplied,
} from './Event.logical.patch';

export {
  applyNodeLogicalPatch,
  removeNodeLogicalPatch,
  isLogicalPatchApplied,
  getLogicalParent,
  linkLogicalParent,
} from './Node.logical.patch';

export {
  applyEventLogicalPatch,
  removeEventLogicalPatch,
  isEventLogicalPatchApplied,
  dispatchLogical,
  addLogicalEventListener,
  removeLogicalEventListener,
} from './Event.logical.patch';

export { default as PortalDirective, _resetPortalState } from './PortalDirective';
export { default as PortalOutlet } from './PortalOutlet';

import PortalDirective from './PortalDirective';
import PortalOutlet from './PortalOutlet';

/**
 * Define the portal custom elements (`portal-directive` customized built-in + `portal-outlet`).
 * Idempotent and irreversible (custom-element definitions are global and cannot be undone), so this
 * stays separate from the reversible `applyPatches`/`removePatches` prototype-patch pair.
 */
export function definePortalElements(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get('portal-directive')) {
    customElements.define('portal-directive', PortalDirective, { extends: 'template' });
  }
  if (!customElements.get('portal-outlet')) {
    customElements.define('portal-outlet', PortalOutlet);
  }
}

/** Apply all webportals patches (logical-tree + logical-event) and define the portal elements. */
export function applyPatches(): void {
  _applyNodeLogicalPatch();
  _applyEventLogicalPatch();
  definePortalElements();
}

/** Remove all webportals patches. */
export function removePatches(): void {
  _removeEventLogicalPatch();
  _removeNodeLogicalPatch();
}

/** Whether all webportals patches are applied. */
export function isPatched(): boolean {
  return _isLogicalPatchApplied() && _isEventLogicalPatchApplied();
}
