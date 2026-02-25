/**
 * Content replacement strategy trait.
 *
 * Hides existing children and stamps a fallback template. On cleanup,
 * restores the original children and removes the fallback.
 *
 * Applies:
 * - `aria-busy="true"`
 * - `data-loader-state="loading"`
 * - Existing children moved into a hidden container (preserves state)
 * - Fallback content stamped in place
 *
 * Maps to: LoaderIntent.strategy === 'replacement'
 *
 * @module blocks/resource-loader/traits
 */

import type { TraitHandle } from '../types';

export interface ReplacementOptions {
  /**
   * Fallback content to show during loading.
   * - HTMLTemplateElement: its `.content` is cloned and stamped
   * - string: used as innerHTML for a container
   * - undefined: default "Loading..." text with role="status"
   */
  fallback?: HTMLTemplateElement | string;
}

/**
 * Apply content replacement to a target element.
 *
 * @param target - The element whose content to replace
 * @param options - Configuration options
 * @returns TraitHandle with cleanup function
 */
export function withReplacement(
  target: HTMLElement,
  options?: ReplacementOptions,
): TraitHandle {
  // Capture previous state
  const prevAriaBusy = target.getAttribute('aria-busy');
  const prevLoaderState = target.getAttribute('data-loader-state');

  // Move existing children into a hidden container (preserves nodes
  // and event listeners for restoration)
  const hiddenContainer = document.createElement('div');
  hiddenContainer.setAttribute('hidden', '');
  hiddenContainer.setAttribute('data-loader-hidden', '');

  while (target.firstChild) {
    hiddenContainer.appendChild(target.firstChild);
  }
  target.appendChild(hiddenContainer);

  // Create and stamp fallback content
  const fallbackContainer = document.createElement('div');
  fallbackContainer.setAttribute('data-loader-fallback', '');

  if (options?.fallback instanceof HTMLTemplateElement) {
    const clone = options.fallback.content.cloneNode(true) as DocumentFragment;
    fallbackContainer.appendChild(clone);
  } else if (typeof options?.fallback === 'string') {
    fallbackContainer.innerHTML = options.fallback;
  } else {
    fallbackContainer.setAttribute('role', 'status');
    fallbackContainer.setAttribute('aria-label', 'Loading');
    fallbackContainer.textContent = 'Loading...';
  }

  target.appendChild(fallbackContainer);

  // Apply ARIA state
  target.setAttribute('aria-busy', 'true');
  target.setAttribute('data-loader-state', 'loading');

  return {
    cleanup() {
      // Remove fallback
      if (fallbackContainer.parentNode === target) {
        target.removeChild(fallbackContainer);
      }

      // Restore hidden children
      if (hiddenContainer.parentNode === target) {
        while (hiddenContainer.firstChild) {
          target.insertBefore(hiddenContainer.firstChild, hiddenContainer);
        }
        target.removeChild(hiddenContainer);
      }

      // Restore aria-busy
      if (prevAriaBusy !== null) {
        target.setAttribute('aria-busy', prevAriaBusy);
      } else {
        target.removeAttribute('aria-busy');
      }

      // Restore data-loader-state
      if (prevLoaderState !== null) {
        target.setAttribute('data-loader-state', prevLoaderState);
      } else {
        target.removeAttribute('data-loader-state');
      }
    },
  };
}
