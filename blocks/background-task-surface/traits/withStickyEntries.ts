/**
 * Sticky entries trait.
 *
 * Keeps a resolved entry until it is explicitly dismissed, instead of
 * auto-clearing on success. Error entries are sticky regardless of this trait
 * (so a failure that happened off-view is still reviewable); this trait extends
 * that durability to successful entries.
 *
 * Maps to: `background-task.persistence.sticky` (default is `transient`).
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withStickyEntries(surface: BackgroundTaskSurface): TraitHandle {
  const prev = surface.getAttribute('persistence');
  surface.setAttribute('persistence', 'sticky');
  return {
    cleanup() {
      if (prev === null) surface.removeAttribute('persistence');
      else surface.setAttribute('persistence', prev);
    },
  };
}
