/**
 * @file Node.logical.patch.ts
 * @description Web Portals — logical-tree polyfill. Adds a writable element-reference
 *   `Element.logicalParent` (reflecting the declarative `logicalparent="id"` IDREF, mirroring
 *   `popoverTargetElement`), plus the read-only logical-ancestry surface
 *   (`logicalInjector` / `logicalAncestors()` / `isLogicalDescendantOf()`) and a logical-ancestry
 *   `getContext()` override. Per #1000 Fork 1 (ratified) and the #1148 foundation slice of epic #1001.
 *
 *   Mirrors the sibling `we:plugs/webinjectors/Node.injectors.patch.ts` /
 *   `we:plugs/webcontexts/Node.contexts.patch.ts` patch shape: an `applyPatches`/`removePatches`
 *   pair, an `is*Applied()` guard, and a `declare global` augmentation. The logical link is held in a
 *   module-private `WeakMap` (the polyfill's authoritative store); the `logicalparent` attribute is the
 *   declarative reflection of it.
 *
 * Contract (from #1000):
 *   - `logicalParent` is a WRITABLE element-reference (no `setLogicalParent()` method). Its setter:
 *       1. validates the graph — `HierarchyRequestError` (a `DOMException`) when the assignment would
 *          create a cycle (the new parent is the element itself or a logical descendant of it);
 *       2. detaches from the prior logical parent;
 *       3. fires a `logicalparentchange` event on the element.
 *   - `logicalInjector` / `logicalAncestors()` / `isLogicalDescendantOf()` are READ-ONLY.
 *   - `getContext()` and the injector chain resolve via LOGICAL ancestry rather than `parentNode`.
 */

import type HTMLInjector from '../webinjectors/HTMLInjector';

let _patchApplied = false;

/**
 * Authoritative store of logical-parent links. The `logicalparent="id"` attribute is the declarative
 * reflection; this WeakMap is the resolved element reference (mirrors how `popoverTargetElement` holds a
 * resolved reference distinct from the `popovertarget` IDREF string).
 */
const logicalParents = new WeakMap<Element, Element>();

/** Check whether the logical-tree patch has been applied. */
export function isLogicalPatchApplied(): boolean {
  return _patchApplied;
}

/**
 * Resolve the `logicalparent="id"` IDREF of an element to an element in its document, if any.
 * Returns `null` for a missing/empty attribute or an unresolvable id (deferred-by-default — #1000 Fork 4
 * residual lives in the directive slice #1150, not here).
 */
function resolveLogicalParentAttr(el: Element): Element | null {
  const id = el.getAttribute('logicalparent');
  if (!id) return null;
  const doc = el.ownerDocument;
  if (!doc) return null;
  return doc.getElementById(id);
}

/**
 * The logical parent of an element: the explicit WeakMap link if set, else the resolved
 * `logicalparent` attribute, else `null`. The WeakMap (imperative `logicalParent =` assignment) wins
 * over the declarative attribute, matching the popover-target precedence (property reflects last write).
 */
function effectiveLogicalParent(el: Element): Element | null {
  const linked = logicalParents.get(el);
  if (linked) return linked;
  return resolveLogicalParentAttr(el);
}

/**
 * Would assigning `candidate` as the logical parent of `el` create a cycle? True when `candidate` IS
 * `el` or is a logical DESCENDANT of `el` (walking up `candidate`'s own logical ancestry must reach `el`).
 */
function wouldCycle(el: Element, candidate: Element): boolean {
  let cursor: Element | null = candidate;
  const seen = new Set<Element>();
  while (cursor) {
    if (cursor === el) return true;
    if (seen.has(cursor)) break; // pre-existing cycle in the candidate's chain — stop, don't hang
    seen.add(cursor);
    cursor = effectiveLogicalParent(cursor);
  }
  return false;
}

/** Apply the logical-tree patch to Element.prototype. */
export function applyNodeLogicalPatch(): void {
  if (_patchApplied) {
    console.warn('Node.logical patch already applied');
    return;
  }

  const accessor = { configurable: true, enumerable: false };

  // logicalParent — writable element-reference (mirrors popoverTargetElement). Getter resolves the
  // effective link; setter validates the graph, detaches the prior link, and fires logicalparentchange.
  Object.defineProperty(Element.prototype, 'logicalParent', {
    ...accessor,
    get(this: Element): Element | null {
      return effectiveLogicalParent(this);
    },
    set(this: Element, value: Element | null) {
      const prior = effectiveLogicalParent(this);
      if (value === prior) return; // no-op: avoid a spurious change event

      if (value != null) {
        if (!(value instanceof Element)) {
          throw new TypeError('logicalParent must be an Element or null');
        }
        if (wouldCycle(this, value)) {
          throw new DOMException(
            'Setting logicalParent would create a cycle in the logical tree',
            'HierarchyRequestError',
          );
        }
      }

      // Detach from the prior logical parent (clear the link), then attach the new one.
      if (value == null) {
        logicalParents.delete(this);
        // keep the declarative attribute consistent with the imperative clear
        if (this.hasAttribute('logicalparent')) this.removeAttribute('logicalparent');
      } else {
        logicalParents.set(this, value);
        if (value.id && this.getAttribute('logicalparent') !== value.id) {
          this.setAttribute('logicalparent', value.id);
        }
      }

      this.dispatchEvent(
        new CustomEvent('logicalparentchange', {
          bubbles: false,
          detail: { previous: prior, current: value },
        }),
      );
    },
  });

  // logicalInjector — read-only. The nearest injector resolved along LOGICAL ancestry (the
  // logical-tree analogue of getClosestInjector, which walks parentNode). Falls back to the native
  // closest injector at the logical root so a logically-portalled subtree still resolves DI.
  Object.defineProperty(Element.prototype, 'logicalInjector', {
    ...accessor,
    get(this: Element): HTMLInjector | null {
      let cursor: Element | null = this;
      const seen = new Set<Element>();
      while (cursor) {
        const own = (cursor as any).getOwnInjector?.();
        if (own) return own;
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const logicalUp = effectiveLogicalParent(cursor);
        cursor = logicalUp ?? cursor.parentElement;
        if (logicalUp == null && cursor) {
          // reached the DOM-parent boundary with no logical hop — defer to the native chain
          return (this as any).getClosestInjector?.() ?? null;
        }
      }
      return (this as any).getClosestInjector?.() ?? null;
    },
  });

  // logicalAncestors() — read-only generator yielding each logical ancestor, nearest first.
  Object.defineProperty(Element.prototype, 'logicalAncestors', {
    ...accessor,
    value: function* (this: Element): Generator<Element> {
      let cursor = effectiveLogicalParent(this);
      const seen = new Set<Element>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        yield cursor;
        cursor = effectiveLogicalParent(cursor);
      }
    },
  });

  // isLogicalDescendantOf() — read-only predicate over logical ancestry.
  Object.defineProperty(Element.prototype, 'isLogicalDescendantOf', {
    ...accessor,
    value(this: Element, ancestor: Element): boolean {
      for (const a of (this as any).logicalAncestors() as Generator<Element>) {
        if (a === ancestor) return true;
      }
      return false;
    },
  });

  _patchApplied = true;
  console.log('[webportals] Node.logical patch applied');
}

/** Remove the logical-tree patch from Element.prototype. */
export function removeNodeLogicalPatch(): void {
  if (!_patchApplied) {
    console.warn('Node.logical patch not applied, nothing to remove');
    return;
  }
  delete (Element.prototype as any).logicalParent;
  delete (Element.prototype as any).logicalInjector;
  delete (Element.prototype as any).logicalAncestors;
  delete (Element.prototype as any).isLogicalDescendantOf;
  _patchApplied = false;
  console.log('[webportals] Node.logical patch removed');
}

/**
 * Unplugged-mode helper: resolve the logical parent of an element WITHOUT the global prototype patch
 * (the mandatory non-invasive surface — #606). The directive/event slices (#1149/#1150) consume this.
 */
export function getLogicalParent(el: Element): Element | null {
  return effectiveLogicalParent(el);
}

/**
 * Unplugged-mode helper: imperatively link a logical parent (same validation as the property setter)
 * without requiring the prototype patch. Returns the element for chaining.
 */
export function linkLogicalParent(el: Element, parent: Element | null): Element {
  if (parent != null) {
    if (!(parent instanceof Element)) throw new TypeError('logical parent must be an Element or null');
    if (wouldCycle(el, parent)) {
      throw new DOMException(
        'Setting logicalParent would create a cycle in the logical tree',
        'HierarchyRequestError',
      );
    }
  }
  const prior = effectiveLogicalParent(el);
  if (parent == null) logicalParents.delete(el);
  else logicalParents.set(el, parent);
  el.dispatchEvent(
    new CustomEvent('logicalparentchange', { bubbles: false, detail: { previous: prior, current: parent } }),
  );
  return el;
}

declare global {
  interface Element {
    /**
     * The logical parent of this element — a writable element reference reflecting the declarative
     * `logicalparent="id"` IDREF (mirrors `popoverTargetElement`). The setter validates the graph
     * (`HierarchyRequestError` on a cycle), detaches from the prior logical parent, and fires
     * `logicalparentchange`.
     */
    logicalParent: Element | null;
    /** Read-only: the nearest injector resolved along logical ancestry. */
    readonly logicalInjector: HTMLInjector | null;
    /** Read-only: yields each logical ancestor, nearest first. */
    logicalAncestors(): Generator<Element>;
    /** Read-only: whether this element is a logical descendant of `ancestor`. */
    isLogicalDescendantOf(ancestor: Element): boolean;
  }
}
