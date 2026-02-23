/**
 * Accessible heading element that replaces itself with the correct
 * `<h1>`–`<h6>` based on context.
 *
 * Level resolution priority:
 * 1. Explicit `level` attribute on the element
 * 2. InjectorRoot `customContexts:headingLevel` provider from ancestor chain
 * 3. DOM traversal fallback (counting sectioning ancestors)
 *
 * @module blocks/transient
 */

import TransientElement from './TransientElement';
import { calculateHeadingLevel } from './calculateHeadingLevel';
import InjectorRoot from '../../plugs/webinjectors/InjectorRoot';
import type { ProviderTypeMap } from '../../plugs/webinjectors/InjectorRoot';

/**
 * Auto-heading custom element.
 *
 * Replaces itself with the semantically correct `<h1>`–`<h6>` element
 * based on document nesting context.
 *
 * @example
 * ```html
 * <section>
 *   <auto-heading>Page Title</auto-heading>        <!-- becomes <h1> -->
 *   <section>
 *     <auto-heading>Section Title</auto-heading>    <!-- becomes <h2> -->
 *   </section>
 * </section>
 * ```
 *
 * @example
 * ```html
 * <!-- Explicit level override -->
 * <auto-heading level="3">Always H3</auto-heading>
 * ```
 */
export default class AutoHeading extends TransientElement {
  /**
   * Exclude the `level` attribute from transfer — it is internal
   * to AutoHeading and should not appear on the replacement `<hN>`.
   */
  get excludedAttributes(): string[] {
    return ['level'];
  }

  /**
   * Resolve the heading tag name based on context.
   *
   * Priority:
   * 1. Explicit `level` attribute
   * 2. InjectorRoot `customContexts:headingLevel` provider
   * 3. DOM traversal fallback (sectioning ancestor count + 1)
   *
   * @returns 'h1' through 'h6'
   */
  resolveTag(): string {
    // 1. Explicit attribute
    const explicit = this.getAttribute('level');
    if (explicit) {
      const n = Number(explicit);
      if (!Number.isNaN(n) && n >= 1) {
        return `h${clamp(n)}`;
      }
    }

    // 2. Injector context
    const injected = InjectorRoot.getProviderOf(
      this,
      'customContexts:headingLevel' as keyof ProviderTypeMap,
    );
    if (typeof injected === 'number' && injected >= 1) {
      return `h${clamp(injected)}`;
    }

    // 3. DOM traversal fallback
    return `h${calculateHeadingLevel(this)}`;
  }
}

/**
 * Clamp a heading level to the valid range 1–6.
 */
function clamp(n: number): number {
  return Math.max(1, Math.min(6, Math.floor(n)));
}
