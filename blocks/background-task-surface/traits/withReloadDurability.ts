/**
 * Reload-durability trait (#134).
 *
 * Arms the opt-in `durability: reload` tier — work that survives a full reload / tab close,
 * delegated to the Background Fetch + service-worker adapter (`reloadDurabilityAdapter`).
 * Wires `durability: route → reload`; `cleanup()` reverts to the route-only baseline.
 *
 * The arming/derivation lives in the element (it feature-detects Background Fetch at
 * arm-time and derives the navigation-guard default + the observable fallback re-arm);
 * this trait just sets the dimension, like the other surface traits.
 *
 * Maps to: `background-task.durability.reload` (default is `route`). Per #450 the enum is
 * exactly `route | reload` — there is no `resumable` tier to set here.
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withReloadDurability(surface: BackgroundTaskSurface): TraitHandle {
  const had = surface.hasAttribute('durability');
  const prev = surface.getAttribute('durability');
  surface.setAttribute('durability', 'reload');
  return {
    cleanup() {
      if (!had) surface.removeAttribute('durability');
      else if (prev !== null) surface.setAttribute('durability', prev);
    },
  };
}
