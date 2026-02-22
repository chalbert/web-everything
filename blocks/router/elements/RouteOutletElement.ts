/**
 * @file blocks/router/elements/RouteOutletElement.ts
 * @description Named auxiliary outlet. Used only when a route needs to render
 * content to a different area (sidebar, header, footer) outside the <route-view>.
 *
 * Not needed for primary rendering — <route-view> stamps content in-place.
 *
 * Default tag name: route-outlet
 */

import type { MatchedRoute } from '../types';

export default class RouteOutletElement extends HTMLElement {
  static observedAttributes = ['name'];

  /** Outlet name (required for named outlets) */
  get name(): string {
    return this.getAttribute('name') || '';
  }

  /** The currently stamped route content nodes */
  get activeContent(): Node[] {
    return (this as any).__routeStampedContent || [];
  }

  /** The currently active MatchedRoute (null when empty) */
  get activeRoute(): MatchedRoute | null {
    return (this as any).__routeMatchedRoute || null;
  }

  connectedCallback(): void {
    // Ensure display: block by default
    if (!this.style.display) {
      this.style.display = 'block';
    }
  }
}
