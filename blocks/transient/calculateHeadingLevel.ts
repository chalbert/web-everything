/**
 * Utility function to calculate heading level by counting
 * sectioning content ancestors in the DOM.
 *
 * @module blocks/transient
 */

/**
 * CSS selector matching all sectioning content elements.
 * @see https://html.spec.whatwg.org/multipage/dom.html#sectioning-content
 */
const SECTIONING_SELECTOR = 'section, article, nav, aside';

/**
 * Calculate the heading level for an element based on its nesting depth
 * within sectioning content elements.
 *
 * Walks up the DOM tree counting `<section>`, `<article>`, `<nav>`, and `<aside>`
 * ancestors. The heading level is the count plus one (root level is 1).
 *
 * The result is clamped to the valid range 1–6.
 *
 * @param element - The element to calculate the heading level for
 * @returns A number from 1 to 6
 *
 * @example
 * ```typescript
 * // <section> <article> <div id="target"> ...
 * const level = calculateHeadingLevel(target); // 3
 * ```
 */
export function calculateHeadingLevel(element: Element): number {
  let count = 0;
  let current = element.parentElement;

  while (current) {
    if (current.matches(SECTIONING_SELECTOR)) {
      count++;
    }
    current = current.parentElement;
  }

  return Math.max(1, Math.min(6, count + 1));
}
