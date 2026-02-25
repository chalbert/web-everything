/**
 * NavListBehavior - Keyboard navigation and active state tracking for navigation landmarks
 *
 * Provides roving tabindex keyboard navigation (Arrow Up/Down, Home, End)
 * and syncs the roving tabindex with `aria-current="page"` set by
 * RouteLinkBehavior on route changes.
 *
 * Default registration name: nav:list
 *
 * @module blocks/navigation
 *
 * @example
 * ```html
 * <nav aria-label="Main" nav:list>
 *   <ul>
 *     <li><a route:link="/">Dashboard</a></li>
 *     <li><a route:link="/apps">Applications</a></li>
 *   </ul>
 * </nav>
 * ```
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';

/** Orientation of the navigation list */
export type NavListOrientation = 'vertical' | 'horizontal';

/** Detail for nav-change custom event */
export interface NavChangeEventDetail {
  from: HTMLElement | null;
  to: HTMLElement;
}

export default class NavListBehavior extends CustomAttribute {
  #items: HTMLElement[] = [];
  #currentIndex: number = -1;
  #keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  #entryChangeHandler: (() => void) | null = null;
  #orientation: NavListOrientation = 'vertical';

  /** Get the current orientation */
  get orientation(): NavListOrientation {
    return this.#orientation;
  }

  /** Get all navigable items */
  get items(): readonly HTMLElement[] {
    return this.#items;
  }

  /** Get the currently focused item index */
  get currentIndex(): number {
    return this.#currentIndex;
  }

  connectedCallback(): void {
    const nav = this.target;
    if (!nav) return;

    this.#readConfig();
    this.#discoverItems();
    this.#setupRovingTabindex();

    // Keyboard navigation
    this.#keydownHandler = (e: KeyboardEvent) => this.#handleKeydown(e);
    nav.addEventListener('keydown', this.#keydownHandler);

    // Listen for route changes to sync roving tabindex with active link
    this.#listenForRouteChanges();
  }

  disconnectedCallback(): void {
    const nav = this.target;
    if (!nav) return;

    if (this.#keydownHandler) {
      nav.removeEventListener('keydown', this.#keydownHandler);
      this.#keydownHandler = null;
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

  // ── Configuration ────────────────────────────────

  #readConfig(): void {
    const orientation = this.target?.getAttribute('orientation');
    if (orientation === 'horizontal' || orientation === 'vertical') {
      this.#orientation = orientation;
    }
  }

  // ── Item Discovery ───────────────────────────────

  #discoverItems(): void {
    if (!this.target) return;

    // Find all links and buttons that are navigation targets
    // Exclude nav:section triggers (they manage their own focus)
    const candidates = Array.from(
      this.target.querySelectorAll<HTMLElement>(
        'a[href], a[route\\:link], button:not([nav\\:section])',
      ),
    );

    // Only include visible items (not inside collapsed sections)
    this.#items = candidates.filter((el) => {
      // Check if element or an ancestor has hidden attribute
      let current: HTMLElement | null = el;
      while (current && current !== this.target) {
        if (current.hasAttribute('hidden')) return false;
        current = current.parentElement;
      }
      return true;
    });
  }

  // ── Roving Tabindex ──────────────────────────────

  #setupRovingTabindex(): void {
    if (this.#items.length === 0) return;

    // Prefer the active item (aria-current="page"), else first item
    const activeIndex = this.#items.findIndex(
      (item) => item.getAttribute('aria-current') === 'page',
    );

    this.#currentIndex = activeIndex >= 0 ? activeIndex : 0;

    for (let i = 0; i < this.#items.length; i++) {
      this.#items[i].setAttribute(
        'tabindex',
        i === this.#currentIndex ? '0' : '-1',
      );
    }
  }

  // ── Keyboard Navigation ──────────────────────────

  #handleKeydown(event: KeyboardEvent): void {
    const isVertical = this.#orientation === 'vertical';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';

    if (![prevKey, nextKey, 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();

    // Re-discover items in case sections were expanded/collapsed
    this.#discoverItems();
    if (this.#items.length === 0) return;

    // Clamp current index in case item list changed
    if (this.#currentIndex >= this.#items.length) {
      this.#currentIndex = this.#items.length - 1;
    }

    let targetIndex = this.#currentIndex;

    switch (event.key) {
      case prevKey:
        targetIndex =
          this.#currentIndex <= 0
            ? this.#items.length - 1
            : this.#currentIndex - 1;
        break;
      case nextKey:
        targetIndex =
          this.#currentIndex >= this.#items.length - 1
            ? 0
            : this.#currentIndex + 1;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = this.#items.length - 1;
        break;
    }

    this.#moveFocus(targetIndex);
  }

  #moveFocus(newIndex: number): void {
    if (newIndex < 0 || newIndex >= this.#items.length) return;

    // Update roving tabindex
    if (this.#currentIndex >= 0 && this.#currentIndex < this.#items.length) {
      this.#items[this.#currentIndex].setAttribute('tabindex', '-1');
    }

    this.#items[newIndex].setAttribute('tabindex', '0');
    this.#items[newIndex].focus();
    this.#currentIndex = newIndex;
  }

  // ── Active State Tracking ────────────────────────

  #listenForRouteChanges(): void {
    this.#entryChangeHandler = () => {
      // Defer to ensure RouteLinkBehavior has updated aria-current first
      requestAnimationFrame(() => {
        this.#discoverItems();
        this.#syncActiveStateQuiet();
      });
    };

    if ('navigation' in window) {
      (window as any).navigation.addEventListener(
        'currententrychange',
        this.#entryChangeHandler,
      );
    } else {
      window.addEventListener('popstate', this.#entryChangeHandler);
    }
  }

  /** Update roving tabindex to track active item without moving DOM focus */
  #syncActiveStateQuiet(): void {
    if (this.#items.length === 0) return;

    const activeIndex = this.#items.findIndex(
      (item) => item.getAttribute('aria-current') === 'page',
    );

    if (activeIndex >= 0 && activeIndex !== this.#currentIndex) {
      if (this.#currentIndex >= 0 && this.#currentIndex < this.#items.length) {
        this.#items[this.#currentIndex].setAttribute('tabindex', '-1');
      }
      this.#items[activeIndex].setAttribute('tabindex', '0');
      this.#currentIndex = activeIndex;
    }
  }
}
