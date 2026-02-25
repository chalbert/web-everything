/**
 * Indeterminate progress trait.
 *
 * Adds data attributes and optional CSS class for styling hooks.
 * The actual visual indicator (spinner, pulse, shimmer) is implemented
 * via CSS targeting `[data-loader-progress="indeterminate"]`.
 *
 * Applies:
 * - `data-loader-progress="indeterminate"`
 * - `aria-busy="true"`
 * - Optional CSS class
 *
 * All changes are reverted on cleanup().
 *
 * Maps to: LoaderIntent.progress === 'indeterminate'
 *
 * @module blocks/resource-loader/traits
 */

import type { TraitHandle } from '../types';

export interface IndeterminateOptions {
  /** Custom CSS class to add during loading */
  className?: string;
}

/**
 * Apply indeterminate progress indication to a target element.
 *
 * @param target - The element to indicate progress on
 * @param options - Configuration options
 * @returns TraitHandle with cleanup function
 */
export function withIndeterminate(
  target: HTMLElement,
  options?: IndeterminateOptions,
): TraitHandle {
  const className = options?.className;

  // Capture previous values
  const prevProgress = target.getAttribute('data-loader-progress');
  const prevAriaBusy = target.getAttribute('aria-busy');

  // Apply indeterminate state
  target.setAttribute('data-loader-progress', 'indeterminate');
  target.setAttribute('aria-busy', 'true');
  if (className) {
    target.classList.add(className);
  }

  return {
    cleanup() {
      if (prevProgress !== null) {
        target.setAttribute('data-loader-progress', prevProgress);
      } else {
        target.removeAttribute('data-loader-progress');
      }
      if (prevAriaBusy !== null) {
        target.setAttribute('aria-busy', prevAriaBusy);
      } else {
        target.removeAttribute('aria-busy');
      }
      if (className) {
        target.classList.remove(className);
      }
    },
  };
}
