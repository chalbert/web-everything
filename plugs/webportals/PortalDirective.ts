/**
 * @file PortalDirective.ts
 * @description Web Portals — the high-level `portal-directive` API (slice #1150 of epic #1001,
 *   per the ratified #1000 Fork 4 contract). Builds on the logical-tree polyfill (#1148) and the
 *   logical-event layer (#1149): a `<template is="portal-directive" target="id">` projects its
 *   content into a remote outlet while the projected nodes stay LOGICALLY children of the directive
 *   (their declaration element), so DI/context and event retargeting flow from the declaration site,
 *   not the physical mount.
 *
 * Contract (from #1000 Fork 4):
 *   - attributes: `target` (outlet IDREF), `disabled` (boolean — in-place fallback), `required`
 *     (boolean — a missing target throws synchronously rather than deferring).
 *   - resolution: outlet PRESENT → attach immediately; ABSENT → deferred-by-default
 *     (attach-or-observe via ONE shared, document-rooted observer — never one observer per portal);
 *     `required` + absent → synchronous `NotFoundError` `DOMException`.
 *   - an unresolved deferred portal is WARNED at a STRUCTURAL trigger (`DOMContentLoaded`, or one
 *     `requestAnimationFrame` if the document already parsed) — never on a wall-clock timeout.
 *   - on attach: each projected top-level node gets `logicalParent = <the directive>` (the declaration
 *     element), which is what wires logical event proxying (retarget host = declaration element) via
 *     the #1149 `dispatchLogical` layer.
 *   - cleanup on disconnect: projected nodes are withdrawn, logical links cleared, the outlet notified.
 *
 * Fork 4 residual (confirmed during #1150): the sibling `InjectorRoot` observer is document-rooted
 * (`observe(document.body, { subtree: true, childList: true })`), so the deferred path uses ONE
 * shared document-rooted observer here too — no per-portal fallback.
 */

import CustomTemplateDirective from '../webdirectives/CustomTemplateDirective';
import type PortalOutlet from './PortalOutlet';

/** An outlet is any element; a `portal-outlet` additionally tracks an ordered portal list. */
type OutletElement = Element & Partial<Pick<PortalOutlet, 'registerPortal' | 'unregisterPortal'>>;

/* ── Shared deferred-resolution machinery (ONE observer for ALL pending portals) ──────────────── */

const pending = new Set<PortalDirective>();
let sharedObserver: MutationObserver | null = null;

/** Resolve every pending portal whose outlet has since appeared; tear the observer down when drained. */
function resolvePending(): void {
  for (const portal of [...pending]) {
    const outlet = portal._tryResolveOutlet();
    if (outlet) {
      pending.delete(portal);
      portal._attachTo(outlet);
    }
  }
  if (pending.size === 0 && sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}

/** Register a portal for deferred resolution, lazily starting the single document-rooted observer. */
function registerPending(portal: PortalDirective): void {
  pending.add(portal);
  if (!sharedObserver && typeof MutationObserver !== 'undefined') {
    sharedObserver = new MutationObserver(resolvePending);
    // Document-rooted, mirroring InjectorRoot (confirmed Fork-4) — observe additions anywhere.
    sharedObserver.observe(document.documentElement, { subtree: true, childList: true });
  }
}

function unregisterPending(portal: PortalDirective): void {
  pending.delete(portal);
  if (pending.size === 0 && sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}

/** Warn — at a STRUCTURAL trigger, never a wall-clock timer — if a deferred portal stays unresolved. */
function scheduleUnresolvedWarning(portal: PortalDirective): void {
  const check = () => {
    if (pending.has(portal)) {
      console.warn(
        `[webportals] portal-directive: target "${portal.target}" never resolved to an outlet`,
      );
    }
  };
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check, { once: true });
  } else if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(check);
  } else {
    // No structural trigger available (non-DOM host) — check synchronously on the microtask queue.
    queueMicrotask(check);
  }
}

/** Test-only: drain the shared observer + pending set (the module holds process-global state). */
export function _resetPortalState(): void {
  pending.clear();
  if (sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}

/* ── PortalDirective ──────────────────────────────────────────────────────────────────────────── */

export default class PortalDirective extends CustomTemplateDirective {
  static observedAttributes = ['target', 'disabled', 'required'];

  /** Top-level nodes currently projected into the outlet (or rendered in place when disabled). */
  #projected: ChildNode[] = [];
  /** The outlet this portal is currently attached to, if any. */
  #outlet: OutletElement | null = null;
  /** True once content has been rendered in place (disabled fallback) rather than portalled. */
  #inPlace = false;

  /* ── reflected attributes ── */

  get target(): string {
    return this.getAttribute('target') ?? '';
  }
  set target(value: string) {
    this.setAttribute('target', value);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get required(): boolean {
    return this.hasAttribute('required');
  }
  set required(value: boolean) {
    if (value) this.setAttribute('required', '');
    else this.removeAttribute('required');
  }

  /* ── lifecycle ── */

  connectedCallback(): void {
    this.#activate();
  }

  disconnectedCallback(): void {
    this.#teardown();
  }

  attributeChangedCallback(): void {
    // Re-evaluate placement whenever target/disabled/required changes on a connected directive.
    if (!this.isConnected) return;
    this.#teardown();
    this.#activate();
  }

  /* ── placement ── */

  #activate(): void {
    if (this.disabled) {
      this.#renderInPlace();
      return;
    }
    const outlet = this._tryResolveOutlet();
    if (outlet) {
      this._attachTo(outlet);
      return;
    }
    if (this.required) {
      throw new DOMException(
        `portal-directive: required target "${this.target}" was not found`,
        'NotFoundError',
      );
    }
    // Deferred-by-default: observe for the outlet to appear, and warn at the structural trigger.
    registerPending(this);
    scheduleUnresolvedWarning(this);
  }

  /** Resolve the `target` IDREF to an element in this directive's document, or null. */
  _tryResolveOutlet(): OutletElement | null {
    const id = this.target;
    if (!id) return null;
    const doc = this.ownerDocument;
    if (!doc) return null;
    return (doc.getElementById(id) as OutletElement | null) ?? null;
  }

  /** Project the template content into the outlet, link it logically, and notify the outlet. */
  _attachTo(outlet: OutletElement): void {
    unregisterPending(this);
    this.#outlet = outlet;
    this.#inPlace = false;

    const nodes = Array.from(this.content.childNodes);
    for (const node of nodes) {
      outlet.appendChild(node);
      this.#projected.push(node);
      // The projected node stays LOGICALLY a child of this directive (its declaration element),
      // which wires event retargeting (host = declaration element) through the #1149 layer.
      if (node instanceof Element) {
        node.logicalParent = this;
      }
    }
    outlet.registerPortal?.(this);
  }

  /** Disabled fallback: render the content in place, right after the directive, with no portalling. */
  #renderInPlace(): void {
    this.#inPlace = true;
    const parent = this.parentNode;
    if (!parent) return;
    const nodes = Array.from(this.content.childNodes);
    let anchor: ChildNode = this;
    for (const node of nodes) {
      parent.insertBefore(node, anchor.nextSibling);
      this.#projected.push(node);
      anchor = node;
    }
  }

  /** Withdraw all projected/in-place nodes, clear logical links, and notify the outlet. */
  #teardown(): void {
    unregisterPending(this);
    for (const node of this.#projected) {
      if (node instanceof Element) node.logicalParent = null;
      // Return the node to the template content so a re-activate can re-project it.
      this.content.appendChild(node);
    }
    this.#projected = [];
    if (this.#outlet) {
      this.#outlet.unregisterPortal?.(this);
      this.#outlet = null;
    }
    this.#inPlace = false;
  }

  /** The outlet this portal is currently attached to (null when deferred, disabled, or detached). */
  get outlet(): Element | null {
    return this.#outlet;
  }

  /** Whether the content is currently rendered in place (the disabled fallback). */
  get isInPlace(): boolean {
    return this.#inPlace;
  }
}
