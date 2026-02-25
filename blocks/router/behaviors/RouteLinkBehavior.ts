/**
 * @file blocks/router/behaviors/RouteLinkBehavior.ts
 * @description Navigation link behavior. Intercepts clicks to use
 * Navigation API (or history.pushState) instead of full page navigation.
 * Manages .active class on the host <a> element when its route matches.
 *
 * Default registration name: route:link
 * Value: target path (e.g., "/users/123")
 *
 * @example
 * ```html
 * <a route:link="/users/123">Profile</a>
 * ```
 */

import CustomAttribute from '../../../plugs/webbehaviors/CustomAttribute';

export default class RouteLinkBehavior extends CustomAttribute {
  #clickHandler: ((event: MouseEvent) => void) | null = null;
  #entryChangeHandler: (() => void) | null = null;

  /** Whether this link's route is currently active */
  get isActive(): boolean {
    return this.target?.classList.contains('active') ?? false;
  }

  connectedCallback(): void {
    const anchor = this.target;
    if (!anchor) return;

    // Set href on the <a> for accessibility and right-click "Copy link"
    if (anchor instanceof HTMLAnchorElement) {
      anchor.setAttribute('href', this.value);
    }

    // Click handler — intercept navigation
    this.#clickHandler = (event: MouseEvent) => {
      // Don't intercept modified clicks (open in new tab, etc.)
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return; // Only left click

      event.preventDefault();

      if ('navigation' in window) {
        (window as any).navigation.navigate(this.value);
      } else {
        history.pushState(null, '', this.value);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    anchor.addEventListener('click', this.#clickHandler);

    // Track active state
    this.#updateActiveState();

    if ('navigation' in window) {
      this.#entryChangeHandler = () => this.#updateActiveState();
      (window as any).navigation.addEventListener(
        'currententrychange',
        this.#entryChangeHandler,
      );
    } else {
      // For History fallback, listen to popstate
      this.#entryChangeHandler = () => this.#updateActiveState();
      window.addEventListener('popstate', this.#entryChangeHandler);
    }
  }

  disconnectedCallback(): void {
    const anchor = this.target;
    if (!anchor) return;

    if (this.#clickHandler) {
      anchor.removeEventListener('click', this.#clickHandler);
      this.#clickHandler = null;
    }

    if (this.#entryChangeHandler) {
      if ('navigation' in window) {
        (window as any).navigation.removeEventListener(
          'currententrychange',
          this.#entryChangeHandler,
        );
      } else {
        window.removeEventListener('popstate', this.#entryChangeHandler);
      }
      this.#entryChangeHandler = null;
    }
  }

  #updateActiveState(): void {
    const anchor = this.target;
    if (!anchor) return;

    const currentPath = window.location.pathname;
    const linkPath = this.value;

    if (currentPath === linkPath) {
      anchor.classList.add('active');
      anchor.setAttribute('aria-current', 'page');
    } else {
      anchor.classList.remove('active');
      anchor.removeAttribute('aria-current');
    }
  }
}
