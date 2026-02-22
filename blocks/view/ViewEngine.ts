/**
 * @file ViewEngine.ts
 * @description Shared view primitive for show/hide/toggle operations.
 *
 * All state lives in the DOM — the engine is stateless. Instances hold
 * configuration defaults; per-call overrides are supported.
 *
 * Features:
 * - Multiple hidden modes (display, content-visibility, until-found, inert)
 * - Toggle events matching Popover API shape (beforetoggle / toggle)
 * - Exclusive groups via the `name` attribute
 * - Opt-in View Transitions API integration
 */

/** Hidden mode determines HOW an element is hidden */
export type ViewHiddenMode = 'display' | 'content-visibility' | 'until-found' | 'inert';

/** Matches Popover API state values */
export type ViewState = 'hidden' | 'visible';

/** Configuration — instances hold defaults, methods accept overrides */
export interface ViewOptions {
  /** How to hide the element. Default: 'content-visibility' */
  hiddenMode?: ViewHiddenMode;
  /** Wrap show/hide in document.startViewTransition(). Default: false */
  transition?: boolean;
}

/** Detail shape for toggle events, matching Popover API */
export interface ViewToggleEventDetail {
  oldState: ViewState;
  newState: ViewState;
}

/**
 * Data attribute used to track content-visibility hidden state.
 * CSS `style.contentVisibility` is not reliably detectable in all environments,
 * so we mirror the state in a data attribute for programmatic checks.
 */
const VIEW_HIDDEN_ATTR = 'data-view-hidden';

/**
 * Shared view primitive. Instances hold configuration defaults.
 * All state lives in the DOM — the primitive is stateless.
 *
 * @example
 * ```typescript
 * // Router creates one with preferred defaults
 * const view = new ViewEngine({ hiddenMode: 'content-visibility', transition: true });
 * view.show(outletContent);
 * view.hide(previousContent);
 * ```
 *
 * @example
 * ```typescript
 * // Default instance
 * const view = new ViewEngine();
 * view.toggle(element);
 * view.isVisible(element); // true or false
 * ```
 */
export default class ViewEngine {
  #defaults: Required<ViewOptions>;

  constructor(options?: ViewOptions) {
    this.#defaults = {
      hiddenMode: options?.hiddenMode ?? 'content-visibility',
      transition: options?.transition ?? false,
    };
  }

  /**
   * Show element. Removes hidden state. Hides exclusive group siblings.
   *
   * @returns true if toggle happened, false if already visible or cancelled
   */
  show(element: Element, options?: ViewOptions): boolean {
    if (this.isVisible(element)) return false;

    const detail: ViewToggleEventDetail = { oldState: 'hidden', newState: 'visible' };
    if (!this.#fireBeforeToggle(element, detail)) return false;

    const doShow = () => {
      this.#removeHiddenState(element);
      this.#hideGroupSiblings(element);
      this.#fireToggle(element, detail);
    };

    if (this.#shouldTransition(options)) {
      this.#withTransition(doShow);
    } else {
      doShow();
    }

    return true;
  }

  /**
   * Hide element. Applies hidden mode.
   *
   * @returns true if toggle happened, false if already hidden or cancelled
   */
  hide(element: Element, options?: ViewOptions): boolean {
    if (!this.isVisible(element)) return false;

    const detail: ViewToggleEventDetail = { oldState: 'visible', newState: 'hidden' };
    if (!this.#fireBeforeToggle(element, detail)) return false;

    const mode = this.getHiddenMode(element, options);

    const doHide = () => {
      this.#applyHiddenMode(element, mode);
      this.#fireToggle(element, detail);
    };

    if (this.#shouldTransition(options)) {
      this.#withTransition(doHide);
    } else {
      doHide();
    }

    return true;
  }

  /**
   * Toggle: show if hidden, hide if visible.
   *
   * @returns true if toggle happened, false if cancelled
   */
  toggle(element: Element, options?: ViewOptions): boolean {
    if (this.isVisible(element)) {
      return this.hide(element, options);
    }
    return this.show(element, options);
  }

  /**
   * Is the element currently visible?
   *
   * Checks for `hidden` attribute, `data-view-hidden` marker (content-visibility mode),
   * and `inert` attribute.
   */
  isVisible(element: Element): boolean {
    // Check hidden attribute (covers display and until-found modes)
    if (element.hasAttribute('hidden')) return false;

    // Check content-visibility mode via data attribute marker
    if (element.hasAttribute(VIEW_HIDDEN_ATTR)) return false;

    // Check inert attribute
    if (element.hasAttribute('inert')) return false;

    return true;
  }

  /**
   * Read hidden-mode from element attribute, fallback to options, then instance default.
   */
  getHiddenMode(element: Element, options?: ViewOptions): ViewHiddenMode {
    if (options?.hiddenMode) return options.hiddenMode;

    const attr = element.getAttribute('hidden-mode');
    if (attr && isValidHiddenMode(attr)) return attr;

    return this.#defaults.hiddenMode;
  }

  /**
   * Read name attribute for exclusive group membership.
   */
  getGroupName(element: Element): string | undefined {
    return element.getAttribute('name') ?? undefined;
  }

  /**
   * Find all elements in the same exclusive group (same name, same parent).
   */
  getGroupMembers(element: Element): Element[] {
    const name = this.getGroupName(element);
    if (!name || !element.parentElement) return [];

    return Array.from(
      element.parentElement.querySelectorAll(`:scope > [name="${CSS.escape(name)}"]`)
    );
  }

  // ── Private methods ────────────────────────────────

  /**
   * Fire cancelable beforetoggle event.
   * @returns false if the event was cancelled
   */
  #fireBeforeToggle(element: Element, detail: ViewToggleEventDetail): boolean {
    const event = new CustomEvent('beforetoggle', {
      bubbles: false,
      cancelable: true,
      detail,
    });
    return element.dispatchEvent(event);
  }

  /** Fire non-cancelable toggle event. */
  #fireToggle(element: Element, detail: ViewToggleEventDetail): void {
    const event = new CustomEvent('toggle', {
      bubbles: false,
      cancelable: false,
      detail,
    });
    element.dispatchEvent(event);
  }

  /** Remove whatever hidden state is currently applied. */
  #removeHiddenState(element: Element): void {
    const htmlEl = element as HTMLElement;

    // Remove hidden attribute (covers display and until-found modes)
    htmlEl.removeAttribute('hidden');

    // Remove content-visibility mode
    if (htmlEl.hasAttribute(VIEW_HIDDEN_ATTR)) {
      htmlEl.style.contentVisibility = '';
      htmlEl.removeAttribute(VIEW_HIDDEN_ATTR);
    }

    // Remove inert
    htmlEl.removeAttribute('inert');
  }

  /** Apply the hidden mode to an element. */
  #applyHiddenMode(element: Element, mode: ViewHiddenMode): void {
    const htmlEl = element as HTMLElement;

    switch (mode) {
      case 'display':
        htmlEl.setAttribute('hidden', '');
        break;
      case 'content-visibility':
        htmlEl.style.contentVisibility = 'hidden';
        htmlEl.setAttribute(VIEW_HIDDEN_ATTR, 'content-visibility');
        break;
      case 'until-found':
        htmlEl.setAttribute('hidden', 'until-found');
        break;
      case 'inert':
        htmlEl.setAttribute('inert', '');
        break;
    }
  }

  /** Hide all visible group siblings when showing an element. */
  #hideGroupSiblings(element: Element): void {
    const name = this.getGroupName(element);
    if (!name) return;

    const members = this.getGroupMembers(element);
    for (const member of members) {
      if (member !== element && this.isVisible(member)) {
        this.hide(member);
      }
    }
  }

  /** Whether to wrap the operation in a view transition. */
  #shouldTransition(options?: ViewOptions): boolean {
    const transition = options?.transition ?? this.#defaults.transition;
    return transition && typeof document !== 'undefined' && 'startViewTransition' in document;
  }

  /** Wrap a DOM mutation in a view transition. */
  #withTransition(fn: () => void): void {
    (document as any).startViewTransition(fn);
  }
}

/** Type guard for valid hidden mode values. */
function isValidHiddenMode(value: string): value is ViewHiddenMode {
  return value === 'display' || value === 'content-visibility' || value === 'until-found' || value === 'inert';
}
