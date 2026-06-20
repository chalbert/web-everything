/**
 * @file PortalOutlet.ts
 * @description Web Portals — the `<portal-outlet>` element (slice #1150 of epic #1001, per the
 *   ratified #1000 Fork 4 contract). A remote mount point that tracks the ordered set of portals
 *   currently projecting into it and fires `portalchange` (with an `onportalchange` IDL handler) on
 *   every attach/detach, so a host can react to its projected content changing.
 *
 *   Order is registration order (= attach order), exposed read-only via `portals`.
 */

import type PortalDirective from './PortalDirective';

export default class PortalOutlet extends HTMLElement {
  /** Portals currently projecting into this outlet, in registration (attach) order. */
  #portals: PortalDirective[] = [];
  /** Backing slot for the `onportalchange` IDL event-handler attribute. */
  #onportalchange: ((this: PortalOutlet, ev: Event) => unknown) | null = null;

  /** The ordered portals currently attached to this outlet (read-only snapshot). */
  get portals(): readonly PortalDirective[] {
    return [...this.#portals];
  }

  /** Register a portal as attached (idempotent); fires `portalchange` on a real change. */
  registerPortal(portal: PortalDirective): void {
    if (this.#portals.includes(portal)) return;
    this.#portals.push(portal);
    this.#fireChange();
  }

  /** Remove a portal (idempotent); fires `portalchange` on a real change. */
  unregisterPortal(portal: PortalDirective): void {
    const i = this.#portals.indexOf(portal);
    if (i < 0) return;
    this.#portals.splice(i, 1);
    this.#fireChange();
  }

  #fireChange(): void {
    this.dispatchEvent(new Event('portalchange'));
  }

  /* ── onportalchange IDL event-handler attribute (mirrors e.g. onchange) ──
   * Backed by addEventListener, the standard way to implement a custom on-handler — real browsers do
   * NOT auto-wire non-standard `on*` properties, so this registration is required. (Note: jsdom DOES
   * auto-invoke any `on<type>` property at dispatch time, so under jsdom — and only jsdom — a handler
   * set here fires twice; assert change counts via `addEventListener('portalchange', …)` in tests.) */

  get onportalchange(): ((this: PortalOutlet, ev: Event) => unknown) | null {
    return this.#onportalchange;
  }
  set onportalchange(handler: ((this: PortalOutlet, ev: Event) => unknown) | null) {
    if (this.#onportalchange) {
      this.removeEventListener('portalchange', this.#onportalchange as EventListener);
    }
    this.#onportalchange = typeof handler === 'function' ? handler : null;
    if (this.#onportalchange) {
      this.addEventListener('portalchange', this.#onportalchange as EventListener);
    }
  }
}
