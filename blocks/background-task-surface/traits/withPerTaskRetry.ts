/**
 * Per-task retry trait.
 *
 * Exposes a retry affordance on a failed entry. Activating it dispatches a
 * cancelable `background-task-retry`; if a host does not intercept, recovery is
 * delegated to the carried Loader handle's `retry()` (the Reliability Intent's
 * job). The surface owns the affordance, not the recovery policy.
 *
 * Maps to: `background-task.recovery.manual`.
 *
 * @module blocks/background-task-surface/traits
 */

import type { BackgroundTaskSurface, TraitHandle } from '../types';

export function withPerTaskRetry(surface: BackgroundTaskSurface): TraitHandle {
  const had = surface.hasAttribute('retry');
  surface.setAttribute('retry', '');
  return {
    cleanup() {
      if (!had) surface.removeAttribute('retry');
    },
  };
}
