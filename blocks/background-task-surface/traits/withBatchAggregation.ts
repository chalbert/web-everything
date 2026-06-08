/**
 * Batch aggregation trait.
 *
 * Presents multiple concurrent tasks at once — each with its own progress and
 * retry — where one task's failure does not abort the others. The default
 * (no trait) is single aggregation: one entry shown at a time.
 *
 * Maps to: `background-task.aggregation.batch`.
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withBatchAggregation(surface: BackgroundTaskSurface): TraitHandle {
  const prev = surface.getAttribute('aggregation');
  surface.setAttribute('aggregation', 'batch');
  return {
    cleanup() {
      if (prev === null) surface.removeAttribute('aggregation');
      else surface.setAttribute('aggregation', prev);
    },
  };
}
