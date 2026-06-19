/**
 * @file webportals/index.ts
 * @description Web Portals plug — logical-tree polyfill (foundation slice #1148 of epic #1001).
 *   Mirrors the sibling webinjectors/webcontexts plug index: an `applyPatches`/`removePatches` pair
 *   plus an `isPatched()` guard, and re-exports the unplugged-mode helpers (#606 non-invasive surface).
 *
 *   This is the foundation only — logical event propagation (#1149) and the portal directive (#1150)
 *   build on top of the logical-parent links established here.
 */

import {
  applyNodeLogicalPatch as _applyNodeLogicalPatch,
  removeNodeLogicalPatch as _removeNodeLogicalPatch,
  isLogicalPatchApplied as _isLogicalPatchApplied,
} from './Node.logical.patch';

export {
  applyNodeLogicalPatch,
  removeNodeLogicalPatch,
  isLogicalPatchApplied,
  getLogicalParent,
  linkLogicalParent,
} from './Node.logical.patch';

/** Apply all webportals patches. */
export function applyPatches(): void {
  _applyNodeLogicalPatch();
}

/** Remove all webportals patches. */
export function removePatches(): void {
  _removeNodeLogicalPatch();
}

/** Whether all webportals patches are applied. */
export function isPatched(): boolean {
  return _isLogicalPatchApplied();
}
