/**
 * @file ExplicitHTMLInsertion.patch.ts
 * @description Trigger parity for the genuinely-detached / self-replacing HTML-insertion APIs that the
 * `CustomTextNodeRegistry` MutationObserver cannot see (#1126, spec
 * we:src/_includes/project-webexpressions.njk:85-99).
 *
 * #1125 made the observer process `addedNodes`, which covers insertions INTO an already-observed,
 * connected tree (`innerHTML`, `insertAdjacentHTML`, `append`). But three explicit APIs slip past it:
 *
 *  - `Range.prototype.createContextualFragment(html)` — produces a DETACHED `DocumentFragment`. It is
 *    never connected to an observed root, so no mutation ever fires for the `{{ }}` / `[[ ]]` text nodes
 *    inside it. We upgrade the fragment eagerly (resolving the registry from the Range's context node).
 *  - `Element.prototype.setHTMLUnsafe(html)` — a fresh parse-and-replace (Sanitizer API). To guarantee
 *    parity regardless of whether the host element is observed, we upgrade the element after the parse.
 *  - `Element.prototype.outerHTML` (setter) — SELF-REPLACING: the element removes itself and inserts
 *    parsed siblings into its parent. The element's own injector context is gone after the call, so we
 *    capture the parent + sibling range BEFORE, then upgrade the freshly-inserted siblings AFTER.
 *
 * Mechanism nod (#817/#854 cross-plug boundary): rather than duplicate the parsing/upgrade logic, every
 * path here resolves the existing `customTextNodes` provider from the injector chain
 * (`InjectorRoot.getProviderOf`) and calls its public `upgrade()` — the same entry point `upgrade()` and
 * the #1125 observer use. This patch is webexpressions-owned (it is the plug whose runtime it serves),
 * paralleling the webcomponents-owned `Element.insertion.patch.ts` for element upgrades.
 */

import InjectorRoot from '../webinjectors/InjectorRoot';
import type CustomTextNodeRegistry from './CustomTextNodeRegistry';
import type { RootNode } from '../core/types';

/**
 * Find a property descriptor anywhere on `proto`'s prototype chain (not just its own properties). Some
 * engines (and happy-dom) define these methods on a SUPERCLASS prototype rather than directly on the
 * leaf — `Object.getOwnPropertyDescriptor(Range.prototype, …)` then returns `undefined`. We still patch
 * by defining an OWN property on the leaf prototype that shadows the inherited one, and we restore by
 * deleting that own shadow.
 */
function findDescriptor(proto: object, name: string): PropertyDescriptor | undefined {
  let current: object | null = proto;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

/**
 * Resolve the `customTextNodes` registry visible to a context node via its injector chain. Returns
 * `undefined` for a fully-detached context (no injector reachable) — callers no-op in that case, leaving
 * the later #1125 insertion path to upgrade the subtree once it is connected to an observed root.
 */
function resolveRegistry(contextNode: Node | null): CustomTextNodeRegistry | undefined {
  if (!contextNode) return undefined;
  return InjectorRoot.getProviderOf(contextNode, 'customTextNodes') as CustomTextNodeRegistry | undefined;
}

// Captured originals (module-load time) so the patch is reversible. Use chain-walking lookup because
// some engines define these on a superclass prototype rather than the leaf. We always apply the shadow
// as an OWN property of the leaf prototype, so restoration re-creates the leaf's PRE-PATCH own state:
// re-define if the leaf owned it originally, otherwise delete the shadow (re-exposing the inherited one).
const createContextualFragmentDescriptor = findDescriptor(Range.prototype, 'createContextualFragment');
const createContextualFragmentWasOwn = Object.prototype.hasOwnProperty.call(
  Range.prototype,
  'createContextualFragment',
);
const setHTMLUnsafeDescriptor = findDescriptor(Element.prototype, 'setHTMLUnsafe');
const setHTMLUnsafeWasOwn = Object.prototype.hasOwnProperty.call(Element.prototype, 'setHTMLUnsafe');
const outerHTMLDescriptor = findDescriptor(Element.prototype, 'outerHTML');
const outerHTMLWasOwn = Object.prototype.hasOwnProperty.call(Element.prototype, 'outerHTML');

let patched = false;

/**
 * Apply the explicit-API trigger-parity patches.
 */
export function patch(): void {
  if (patched) return;
  patched = true;

  // Range.createContextualFragment — upgrade the detached fragment eagerly.
  if (createContextualFragmentDescriptor?.value) {
    Object.defineProperty(Range.prototype, 'createContextualFragment', {
      ...createContextualFragmentDescriptor,
      value(this: Range, html: string): DocumentFragment {
        const fragment = createContextualFragmentDescriptor.value.call(this, html) as DocumentFragment;
        // The fragment is detached; resolve the registry from the Range's context (start) node, which is
        // typically a connected node in the document the fragment is destined for.
        const registry = resolveRegistry(this.startContainer ?? null);
        registry?.upgrade(fragment as unknown as RootNode);
        return fragment;
      },
    });
  }

  // Element.setHTMLUnsafe — upgrade the element after the fresh parse (Sanitizer API; absent in some
  // engines/test envs, so guarded).
  if (setHTMLUnsafeDescriptor?.value) {
    Object.defineProperty(Element.prototype, 'setHTMLUnsafe', {
      ...setHTMLUnsafeDescriptor,
      value(this: Element, ...args: unknown[]): void {
        setHTMLUnsafeDescriptor.value.apply(this, args);
        const registry = resolveRegistry(this);
        registry?.upgrade(this as unknown as RootNode);
      },
    });
  }

  // Element.outerHTML (setter) — self-replacing: capture the insertion window, then upgrade the new
  // siblings the parse inserted into the parent.
  if (outerHTMLDescriptor?.set) {
    Object.defineProperty(Element.prototype, 'outerHTML', {
      ...outerHTMLDescriptor,
      set(this: Element, value: string) {
        const parent = this.parentNode;
        // Resolve the registry from the parent BEFORE the element removes itself (afterwards `this` is
        // detached and its injector chain is gone).
        const registry = parent ? resolveRegistry(parent) : undefined;
        const previousSibling = this.previousSibling;
        const nextSibling = this.nextSibling;

        outerHTMLDescriptor.set!.call(this, value);

        if (parent && registry) {
          // Upgrade exactly the nodes the parse inserted: everything between the captured
          // previous/next siblings (which the setter leaves in place).
          let node: ChildNode | null = previousSibling
            ? previousSibling.nextSibling
            : parent.firstChild;
          while (node && node !== nextSibling) {
            registry.upgrade(node as unknown as RootNode);
            node = node.nextSibling;
          }
        }
      },
    });
  }
}

/**
 * Remove the explicit-API trigger-parity patches (restore captured originals).
 */
export function removePatch(): void {
  if (!patched) return;
  patched = false;

  restoreLeaf(
    Range.prototype,
    'createContextualFragment',
    createContextualFragmentDescriptor,
    createContextualFragmentWasOwn,
  );
  restoreLeaf(Element.prototype, 'setHTMLUnsafe', setHTMLUnsafeDescriptor, setHTMLUnsafeWasOwn);
  restoreLeaf(Element.prototype, 'outerHTML', outerHTMLDescriptor, outerHTMLWasOwn);
}

/**
 * Restore a leaf prototype's pre-patch own state for `name`: re-define the captured descriptor if the
 * leaf owned it originally, otherwise delete our shadow so the inherited member re-surfaces.
 */
function restoreLeaf(
  proto: object,
  name: string,
  original: PropertyDescriptor | undefined,
  wasOwn: boolean,
): void {
  if (!original) return;
  if (wasOwn) {
    Object.defineProperty(proto, name, original);
  } else {
    delete (proto as Record<string, unknown>)[name];
  }
}

// Log patch readiness in development.
if (process.env.NODE_ENV !== 'production') {
  console.log('[webexpressions] ExplicitHTMLInsertion patch ready');
}
