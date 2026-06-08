/**
 * Navigation guard trait.
 *
 * While any task is in flight, arms the `beforeunload` prompt (cross-document
 * close / hard reload) and the Navigation API route-leave confirm (same-document
 * SPA navigation); both clear when the last in-flight task resolves. This is the
 * guard that makes the route-only baseline safe — a reload that would lose
 * in-flight work is prompted, not silently dropped.
 *
 * The arming/disarming lives in the element (it tracks live task state); this
 * trait just sets the dimension. The two primitives present as one contract —
 * the paradigm being harvested as the navigation-guard intent (#129).
 *
 * Maps to: `background-task.navigationGuard.warn` (default is none).
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withNavigationGuard(surface: BackgroundTaskSurface): TraitHandle {
  const had = surface.hasAttribute('navigation-guard');
  surface.setAttribute('navigation-guard', '');
  return {
    cleanup() {
      if (!had) surface.removeAttribute('navigation-guard');
    },
  };
}
