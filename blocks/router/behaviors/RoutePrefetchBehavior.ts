/**
 * @file blocks/router/behaviors/RoutePrefetchBehavior.ts
 * @description Prefetch behavior. Controls when a route's loader is
 * prefetched. Paired with route:link on the same element.
 *
 * Default registration name: route:prefetch
 * Value: 'none' | 'hover' | 'visible' | 'eager'
 *
 * @example
 * ```html
 * <a route:link="/about" route:prefetch="hover">About</a>
 * ```
 */

import CustomAttribute from '../../../plugs/webbehaviors/CustomAttribute';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';
import { matchRoute } from '../types';
import type { RouteLoaderFn } from '../types';

/** Cache for prefetched loader results */
const prefetchCache = new Map<string, unknown>();

export default class RoutePrefetchBehavior extends CustomAttribute {
  #observer: IntersectionObserver | null = null;
  #hoverHandler: (() => void) | null = null;
  #focusHandler: (() => void) | null = null;
  #prefetched = false;

  connectedCallback(): void {
    const mode = this.value || 'none';

    switch (mode) {
      case 'hover':
        this.#setupHoverPrefetch();
        break;
      case 'visible':
        this.#setupVisiblePrefetch();
        break;
      case 'eager':
        this.#doPrefetch();
        break;
      case 'none':
      default:
        break;
    }
  }

  disconnectedCallback(): void {
    this.#cleanup();
  }

  #setupHoverPrefetch(): void {
    const el = this.target;
    if (!el) return;

    this.#hoverHandler = () => this.#doPrefetch();
    this.#focusHandler = () => this.#doPrefetch();

    el.addEventListener('mouseenter', this.#hoverHandler);
    el.addEventListener('focus', this.#focusHandler);
  }

  #setupVisiblePrefetch(): void {
    const el = this.target;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: prefetch immediately if no IntersectionObserver
      this.#doPrefetch();
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#doPrefetch();
            this.#observer?.disconnect();
            this.#observer = null;
          }
        }
      },
      { rootMargin: '50px' },
    );

    this.#observer.observe(el);
  }

  #doPrefetch(): void {
    if (this.#prefetched) return;
    this.#prefetched = true;

    // Get the link path from a sibling route:link attribute or from href
    const el = this.target;
    if (!el) return;

    const linkPath = el.getAttribute('href') || '';
    if (!linkPath || prefetchCache.has(linkPath)) return;

    // Find the loader for this path by looking up route definitions
    // from the closest <route-view> ancestor
    const routeView = el.closest('route-view') as any;
    if (!routeView?.routes) return;

    const url = new URL(linkPath, window.location.origin);
    const matched = matchRoute(url, routeView.routes);
    if (!matched?.definition.loader) return;

    // Resolve the loader function
    const loaders = InjectorRoot.getProviderOf(
      el,
      'customContexts:routeLoader' as any,
    ) as Record<string, RouteLoaderFn> | undefined;

    const loader = loaders?.[matched.definition.loader];
    if (!loader) return;

    // Run the loader (fire and forget, cache result)
    const controller = new AbortController();
    loader({
      params: matched.params,
      query: new URLSearchParams(url.search),
      signal: controller.signal,
    })
      .then((data) => {
        prefetchCache.set(linkPath, data);
      })
      .catch(() => {
        // Prefetch failures are silent
      });
  }

  #cleanup(): void {
    const el = this.target;

    if (el && this.#hoverHandler) {
      el.removeEventListener('mouseenter', this.#hoverHandler);
      this.#hoverHandler = null;
    }

    if (el && this.#focusHandler) {
      el.removeEventListener('focus', this.#focusHandler);
      this.#focusHandler = null;
    }

    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }

  /**
   * Get a cached prefetch result for a path.
   * Used by RouteViewElement to skip loader execution if data is already cached.
   */
  static getCached(path: string): unknown | undefined {
    return prefetchCache.get(path);
  }

  /**
   * Clear the prefetch cache. Useful for testing.
   */
  static clearCache(): void {
    prefetchCache.clear();
  }
}
