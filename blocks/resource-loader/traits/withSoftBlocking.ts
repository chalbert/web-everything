/**
 * Soft blocking strategy trait.
 *
 * Content remains visible but non-interactive. Applies:
 * - `aria-busy="true"` for assistive technology
 * - `pointer-events: none` to prevent interaction
 * - Reduced opacity (default 0.6)
 * - `data-loader-state="loading"` for CSS hooks
 *
 * All changes are reverted on cleanup().
 *
 * Maps to: LoaderIntent.strategy === 'soft'
 *
 * @module blocks/resource-loader/traits
 */

import type { TraitHandle } from '../types';

export interface SoftBlockingOptions {
  /** Opacity applied during loading. Default: 0.6 */
  opacity?: number;
}

/**
 * Apply soft blocking to a target element.
 *
 * @param target - The element to apply soft blocking to
 * @param options - Configuration options
 * @returns TraitHandle with cleanup function
 */
export function withSoftBlocking(
  target: HTMLElement,
  options?: SoftBlockingOptions,
): TraitHandle {
  const opacity = options?.opacity ?? 0.6;

  // Capture previous values for restoration
  const prevAriaBusy = target.getAttribute('aria-busy');
  const prevPointerEvents = target.style.pointerEvents;
  const prevOpacity = target.style.opacity;
  const prevLoaderState = target.getAttribute('data-loader-state');

  // Apply soft blocking
  target.setAttribute('aria-busy', 'true');
  target.style.pointerEvents = 'none';
  target.style.opacity = String(opacity);
  target.setAttribute('data-loader-state', 'loading');

  return {
    cleanup() {
      if (prevAriaBusy !== null) {
        target.setAttribute('aria-busy', prevAriaBusy);
      } else {
        target.removeAttribute('aria-busy');
      }
      target.style.pointerEvents = prevPointerEvents;
      target.style.opacity = prevOpacity;
      if (prevLoaderState !== null) {
        target.setAttribute('data-loader-state', prevLoaderState);
      } else {
        target.removeAttribute('data-loader-state');
      }
    },
  };
}
