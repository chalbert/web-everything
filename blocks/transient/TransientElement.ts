/**
 * Abstract base class for custom elements that replace themselves
 * with semantically correct native HTML elements during connectedCallback.
 *
 * The transient element exists only long enough to determine what to render,
 * then it disappears, leaving no wrapper node in the DOM.
 *
 * @module blocks/transient
 */

/**
 * Abstract base class for transient custom elements.
 *
 * Subclasses must implement `resolveTag()` to determine the replacement
 * element tag name. The base class handles attribute transfer, child node
 * transfer, and deferred self-replacement via queueMicrotask.
 *
 * @example
 * ```typescript
 * class AutoHeading extends TransientElement {
 *   resolveTag(): string {
 *     return 'h2';
 *   }
 * }
 * customElements.define('auto-heading', AutoHeading);
 * ```
 */
export default abstract class TransientElement extends HTMLElement {
  /**
   * Guards against double-replacement if connectedCallback fires twice.
   */
  #replaced = false;

  /**
   * Determine the replacement element tag name.
   * Subclasses MUST override this method.
   *
   * @returns A valid HTML element tag name (e.g., 'h2', 'a', 'button')
   */
  abstract resolveTag(): string;

  /**
   * Attributes to exclude from transfer to the replacement element.
   * Subclasses can override to add their own internal attributes.
   *
   * The `is` attribute and `data-transient-*` prefixed attributes
   * are always excluded by the base class.
   */
  get excludedAttributes(): string[] {
    return [];
  }

  connectedCallback(): void {
    if (this.#replaced) return;
    this.#replaced = true;

    const tag = this.resolveTag();
    const el = document.createElement(tag);
    const excluded = new Set(this.excludedAttributes);

    // Transfer attributes (skip 'is', 'data-transient-*', and subclass exclusions)
    for (const { name, value } of this.attributes) {
      if (name === 'is' || name.startsWith('data-transient-') || excluded.has(name)) continue;
      el.setAttribute(name, value);
    }

    // Move children (not clone — preserves event listeners on children)
    el.append(...this.childNodes);

    // Deferred replacement avoids disconnectedCallback re-entrancy
    queueMicrotask(() => this.replaceWith(el));
  }
}
