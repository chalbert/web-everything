/**
 * Completion toast trait.
 *
 * Emits a transient Feedback Intent toast (a bubbling `feedback-toast` event)
 * when a task completes — for the case where the user is on another view and the
 * rail entry auto-clears, so they still learn the backgrounded work finished. The
 * surface owns the emission; a Feedback surface downstream renders the toast.
 *
 * Maps to: `background-task.persistence.transient` (the transient end of the
 * persistence dimension, paired with the off-view live-region announcement).
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withCompletionToast(surface: BackgroundTaskSurface): TraitHandle {
  const had = surface.hasAttribute('completion-toast');
  surface.setAttribute('completion-toast', '');
  return {
    cleanup() {
      if (!had) surface.removeAttribute('completion-toast');
    },
  };
}
