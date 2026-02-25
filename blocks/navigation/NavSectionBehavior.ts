/**
 * NavSectionBehavior - Disclosure toggle for collapsible navigation sections
 *
 * Implements the W3C APG Disclosure Navigation pattern. Manages
 * `aria-expanded`, `aria-controls`, and uses ViewEngine for show/hide.
 *
 * The attribute value is a CSS selector pointing to the controlled element.
 *
 * Default registration name: nav:section
 *
 * @module blocks/navigation
 *
 * @example
 * ```html
 * <button nav:section="#catalog-items">Catalog</button>
 * <ul id="catalog-items">
 *   <li><a route:link="/apps">Applications</a></li>
 * </ul>
 * ```
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import ViewEngine from '../view/ViewEngine';

/** Internal counter for generating unique IDs */
let sectionIdCounter = 0;

export default class NavSectionBehavior extends CustomAttribute {
  #engine: ViewEngine;
  #clickHandler: (() => void) | null = null;
  #keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options?: ConstructorParameters<typeof CustomAttribute>[0]) {
    super(options);
    this.#engine = new ViewEngine({ hiddenMode: 'display' });
  }

  /** Whether the section is currently expanded */
  get isExpanded(): boolean {
    return this.target?.getAttribute('aria-expanded') === 'true';
  }

  /** Get the controlled element via the selector in the attribute value */
  get controlledElement(): HTMLElement | null {
    const selector = this.value;
    if (!selector) return null;
    return document.querySelector<HTMLElement>(selector);
  }

  connectedCallback(): void {
    const trigger = this.target;
    if (!trigger) return;

    const controlled = this.controlledElement;
    if (!controlled) return;

    // Ensure controlled element has an ID (needed for aria-controls)
    if (!controlled.id) {
      controlled.id = `nav-section-${sectionIdCounter++}`;
    }

    // Set ARIA on trigger (use tagName check — more reliable than instanceof)
    if (trigger.tagName !== 'BUTTON') {
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
    }
    trigger.setAttribute('aria-controls', controlled.id);

    // Determine initial state from controlled element visibility
    const isVisible = this.#engine.isVisible(controlled);
    trigger.setAttribute('aria-expanded', String(isVisible));
    if (!isVisible) {
      this.#engine.hide(controlled);
    }

    // Click handler
    this.#clickHandler = () => this.toggle();
    trigger.addEventListener('click', this.#clickHandler);

    // Keydown handler for non-button elements (Enter/Space)
    this.#keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggle();
      }
    };
    trigger.addEventListener('keydown', this.#keydownHandler);
  }

  disconnectedCallback(): void {
    const trigger = this.target;
    if (!trigger) return;

    if (this.#clickHandler) {
      trigger.removeEventListener('click', this.#clickHandler);
      this.#clickHandler = null;
    }
    if (this.#keydownHandler) {
      trigger.removeEventListener('keydown', this.#keydownHandler as EventListener);
      this.#keydownHandler = null;
    }
  }

  /** Toggle the controlled section */
  toggle(): void {
    const trigger = this.target;
    const controlled = this.controlledElement;
    if (!trigger || !controlled) return;

    const willExpand = !this.isExpanded;
    trigger.setAttribute('aria-expanded', String(willExpand));

    if (willExpand) {
      this.#engine.show(controlled);
    } else {
      this.#engine.hide(controlled);
    }
  }

  /** Expand the controlled section */
  expand(): void {
    if (!this.isExpanded) this.toggle();
  }

  /** Collapse the controlled section */
  collapse(): void {
    if (this.isExpanded) this.toggle();
  }
}
