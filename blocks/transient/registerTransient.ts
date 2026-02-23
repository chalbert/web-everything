/**
 * Registration helper for transient components.
 *
 * @module blocks/transient
 */

import AutoHeading from './AutoHeading';

/**
 * Register all transient components with default tag names.
 *
 * Currently registers:
 * - `<auto-heading>` → AutoHeading
 *
 * @example
 * ```typescript
 * import { registerTransient } from 'blocks/transient';
 * registerTransient();
 * ```
 */
export function registerTransient(): void {
  if (!customElements.get('auto-heading')) {
    customElements.define('auto-heading', AutoHeading);
  }
}
