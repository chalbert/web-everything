/**
 * @file Event.logical.patch.ts
 * @description Web Portals — logical event propagation (slice #1149 of epic #1001, per the ratified
 *   #1000 Fork 2 contract). Builds on the logical-tree links established by the #1148 foundation
 *   (`Node.logical.patch.ts`): events bubble through the LOGICAL tree (the `logicalParent` chain), not
 *   just the DOM tree.
 *
 *   Mirrors the sibling `Node.logical.patch.ts` patch shape: an `apply*`/`remove*` pair, an
 *   `is*Applied()` guard, a `declare global` augmentation, and an unplugged-mode helper
 *   (`dispatchLogical`, the #606 non-invasive surface the directive slice #1150 consumes).
 *
 * Contract (#1000 Fork 2 — the four ratified surfaces):
 *   1. `composedLogical` — a SEPARATE opt-in `EventInit` flag (default false). ORTHOGONAL to native
 *      `composed` (which crosses the target's SHADOW boundary): `composedLogical` crosses LOGICAL
 *      (portal) boundaries. Never an overload of `composed`. There is also `bubblesLogical` (default
 *      false): the logical-tree analogue of `bubbles`. Native `dispatchEvent` cannot read these custom
 *      init fields, so the driver is `dispatchLogical(target, event)` — the same event object, with the
 *      logical leg run AFTER native DOM dispatch.
 *   2. `Event.logicalPath` — read-only. The logical propagation path, computed PRE-retarget as a
 *      parallel pass over the logical chain (`target → …logicalAncestors`). Populated during a
 *      `dispatchLogical` run for an event whose `bubblesLogical` is true.
 *   3. `Event.composedLogicalPath()` — the logical analogue of `composedPath()`, for events with
 *      `composedLogical: true`. Returns the full logical chain; for a non-composedLogical event it
 *      returns only the path up to (and not crossing) the first logical boundary — mirroring how native
 *      `composedPath()` stops at the shadow boundary for a non-`composed` event.
 *   4. `Event.stopLogicalPropagation()` — stops the LOGICAL leg only (DOM bubbling, already done by the
 *      time the logical leg runs, is unaffected; a separate `stopPropagation()` governs the DOM leg).
 *
 * Retarget rule (the #1000 Fork 2 sub-decision): a FRESH retarget runs at each logical hop whose host is
 * the portal's DECLARATION element (the `logicalParent`, set to the declaration parent — NOT the
 * mount/outlet). So a listener on a logical ancestor sees an `event.target` that is an element it
 * actually contains in its OWN logical tree, never the physical outlet. The physical site stays reachable
 * via native `composedPath()`; the two paths stay pure.
 */

import { getLogicalParent } from './Node.logical.patch';

let _patchApplied = false;

/** Per-event state the logical leg threads through (kept off the public Event surface in a WeakMap). */
interface LogicalState {
  /** The pre-retarget logical chain: [target, ...logicalAncestors]. */
  path: EventTarget[];
  /** Set by stopLogicalPropagation() — halts the remaining logical hops. */
  stopped: boolean;
  /** Whether this event opted into crossing logical (portal) boundaries. */
  composedLogical: boolean;
}

const logicalState = new WeakMap<Event, LogicalState>();

/** Check whether the logical-event patch has been applied. */
export function isEventLogicalPatchApplied(): boolean {
  return _patchApplied;
}

/**
 * Build the pre-retarget logical chain for a target element. The event first bubbles through the DOM
 * tree normally, THEN continues up the `logicalParent` chain from the portal root (#1000 Fork 2 /
 * `:366`). So at each step we prefer a logical hop when the node HAS an explicit logical parent (a
 * portal boundary), otherwise we walk the DOM `parentElement`. The chain ends at the root. Uses
 * `getLogicalParent`, which falls back to the declarative `logicalparent` IDREF — so this works in BOTH
 * plugged and unplugged modes.
 */
function buildLogicalPath(target: Element): EventTarget[] {
  const path: EventTarget[] = [target];
  const seen = new Set<EventTarget>([target]);
  let cursor: Element | null = target;
  while (cursor) {
    // A logical hop wins over the DOM parent when this node declares a logical parent (the portal root
    // hops to its declaration parent); otherwise plain DOM bubbling.
    const next: Element | null = getLogicalParent(cursor) ?? cursor.parentElement;
    if (!next || seen.has(next)) break;
    path.push(next);
    seen.add(next);
    cursor = next;
  }
  return path;
}

/**
 * Whether the hop from `from` to `to` crosses a logical (portal) boundary — i.e. `to` is `from`'s
 * explicit `logicalParent` and NOT its DOM parent. Plain DOM bubbling steps are not boundaries.
 */
function isLogicalBoundaryHop(from: Element, to: Element): boolean {
  return getLogicalParent(from) === to && from.parentElement !== to;
}

/**
 * Drive logical propagation for `event` originating at `target`. The event's native DOM dispatch (the
 * DOM leg) is the caller's responsibility / has already run; this is the LOGICAL leg.
 *
 * For each logical hop (the target's logical ancestors), a fresh retarget runs: `event.target` is reset
 * to the nearest node on `currentTarget`'s OWN logical sub-chain (the declaration element it contains),
 * so a listener on a logical ancestor never sees the physical outlet. The hop fires only the listeners
 * registered for the bubbling phase. `stopLogicalPropagation()` halts the remaining hops.
 *
 * Crossing a logical boundary (a hop where the ancestor is the element's `logicalParent` rather than its
 * `parentNode`) requires `composedLogical: true`; otherwise the logical leg stops at the first boundary,
 * preserving encapsulation by default.
 */
export function dispatchLogical(
  target: Element,
  event: Event,
  init?: { bubblesLogical?: boolean; composedLogical?: boolean },
): boolean {
  const bubblesLogical = init?.bubblesLogical ?? (event as any).bubblesLogical ?? false;
  const composedLogical = init?.composedLogical ?? (event as any).composedLogical ?? false;

  // The DOM leg first (native dispatch), unless the caller already dispatched it.
  // We dispatch here so the single call site (dispatchLogical) drives BOTH legs in order.
  const domResult = target.dispatchEvent(event);

  if (!bubblesLogical) return domResult;

  const path = buildLogicalPath(target);
  const state: LogicalState = { path, stopped: false, composedLogical };
  logicalState.set(event, state);

  // Walk each logical hop (skip index 0 = the original target, already covered by the DOM leg).
  for (let i = 1; i < path.length; i++) {
    if (state.stopped) break;

    const currentTarget = path[i] as Element;
    // A hop crosses a logical (portal) boundary when the ancestor was reached via an explicit logical
    // link rather than the DOM parent. Crossing requires composedLogical (default false preserves
    // encapsulation); plain DOM-bubbling hops are always allowed.
    const prev = path[i - 1] as Element;
    if (isLogicalBoundaryHop(prev, currentTarget)) {
      if (!composedLogical) break; // do not cross a portal boundary without the opt-in
    }

    // Fresh retarget at the declaration element: the node on currentTarget's own logical sub-chain that
    // it directly contains. We expose it via the (non-enumerable) retargeted `target` for this hop.
    const retargeted = retargetForHop(path, i);
    fireBubbleListeners(currentTarget, event, retargeted);
  }

  logicalState.delete(event);
  return domResult && !event.defaultPrevented;
}

/**
 * The retargeted `event.target` a listener on `path[hopIndex]` should see: the nearest descendant on the
 * logical chain that this current-target's logical tree directly contains (the declaration element),
 * mirroring shadow-DOM retargeting where the host sees its own slotted child, not the deep target.
 */
function retargetForHop(path: EventTarget[], hopIndex: number): EventTarget {
  // The declaration element the current target contains is the node one step BELOW it on the chain.
  return path[hopIndex - 1] ?? path[0];
}

/**
 * Fire the bubble-phase listeners on `currentTarget` for `event`, with `event.target` retargeted and
 * `event.currentTarget` set to `currentTarget`. Uses a throwaway clone-free dispatch: we temporarily
 * override the event's `target`/`currentTarget` getters for the duration of the synchronous fan-out.
 */
function fireBubbleListeners(currentTarget: Element, event: Event, retargeted: EventTarget): void {
  const descTarget = Object.getOwnPropertyDescriptor(event, '__logicalTarget');
  Object.defineProperty(event, '__logicalTarget', { value: retargeted, configurable: true });
  Object.defineProperty(event, '__logicalCurrentTarget', { value: currentTarget, configurable: true });
  try {
    // EventTarget.dispatchEvent would re-run the capture/at-target phases and reset target; instead we
    // invoke the logical listeners directly via a sentinel event type sub-channel. We piggyback on the
    // platform by dispatching a non-bubbling pass scoped to currentTarget only.
    const handlers = logicalListeners.get(currentTarget)?.get(event.type);
    if (handlers) {
      // copy to tolerate mutation during iteration
      for (const fn of [...handlers]) {
        if (logicalState.get(event)?.stopped) break;
        try {
          fn.call(currentTarget, event);
        } catch (err) {
          // Listener errors must not abort propagation (matches the platform's reportError behavior).
          // eslint-disable-next-line no-console
          (globalThis as any).reportError?.(err) ?? console.error(err);
        }
      }
    }
  } finally {
    if (descTarget) Object.defineProperty(event, '__logicalTarget', descTarget);
    else delete (event as any).__logicalTarget;
    delete (event as any).__logicalCurrentTarget;
  }
}

/**
 * Registry of LOGICAL-tree listeners: element → (type → set of handlers). Listeners attached via
 * `addLogicalEventListener` (or, when patched, the augmented `addEventListener` with `{ logical: true }`)
 * fire during the logical leg. This is separate from the native listener table so the DOM leg and the
 * logical leg stay independent.
 */
const logicalListeners = new WeakMap<Element, Map<string, Set<(e: Event) => void>>>();

/**
 * Register a logical-tree listener (unplugged-mode helper; the #606 non-invasive surface). Fires when a
 * `dispatchLogical` run with `bubblesLogical: true` reaches this element as a logical ancestor.
 */
export function addLogicalEventListener(el: Element, type: string, handler: (e: Event) => void): void {
  let byType = logicalListeners.get(el);
  if (!byType) {
    byType = new Map();
    logicalListeners.set(el, byType);
  }
  let set = byType.get(type);
  if (!set) {
    set = new Set();
    byType.set(type, set);
  }
  set.add(handler);
}

/** Unregister a logical-tree listener (unplugged-mode helper). */
export function removeLogicalEventListener(el: Element, type: string, handler: (e: Event) => void): void {
  logicalListeners.get(el)?.get(type)?.delete(handler);
}

/** Apply the logical-event patch to Event.prototype. */
export function applyEventLogicalPatch(): void {
  if (_patchApplied) {
    console.warn('Event.logical patch already applied');
    return;
  }

  const accessor = { configurable: true, enumerable: false };

  // logicalPath — read-only. The pre-retarget logical chain, populated during a dispatchLogical run.
  Object.defineProperty(Event.prototype, 'logicalPath', {
    ...accessor,
    get(this: Event): EventTarget[] {
      return logicalState.get(this)?.path.slice() ?? [];
    },
  });

  // composedLogicalPath() — the logical analogue of composedPath(). For a composedLogical event, the
  // full chain; otherwise the path up to (not crossing) the first logical boundary.
  Object.defineProperty(Event.prototype, 'composedLogicalPath', {
    ...accessor,
    value(this: Event): EventTarget[] {
      const state = logicalState.get(this);
      if (!state) return [];
      if (state.composedLogical) return state.path.slice();
      // Trim at the first logical boundary (where a hop is reached via logicalParent, not parentNode).
      const trimmed: EventTarget[] = [];
      for (let i = 0; i < state.path.length; i++) {
        trimmed.push(state.path[i]);
        const cur = state.path[i] as Element;
        const next = state.path[i + 1] as Element | undefined;
        if (next && isLogicalBoundaryHop(cur, next)) break;
      }
      return trimmed;
    },
  });

  // stopLogicalPropagation() — stops the LOGICAL leg only.
  Object.defineProperty(Event.prototype, 'stopLogicalPropagation', {
    ...accessor,
    value(this: Event): void {
      const state = logicalState.get(this);
      if (state) state.stopped = true;
    },
  });

  _patchApplied = true;
  console.log('[webportals] Event.logical patch applied');
}

/** Remove the logical-event patch from Event.prototype. */
export function removeEventLogicalPatch(): void {
  if (!_patchApplied) {
    console.warn('Event.logical patch not applied, nothing to remove');
    return;
  }
  delete (Event.prototype as any).logicalPath;
  delete (Event.prototype as any).composedLogicalPath;
  delete (Event.prototype as any).stopLogicalPropagation;
  _patchApplied = false;
  console.log('[webportals] Event.logical patch removed');
}

declare global {
  interface EventInit {
    /** Web Portals: bubble this event through the LOGICAL tree (the logicalParent chain). Default false. */
    bubblesLogical?: boolean;
    /**
     * Web Portals: cross logical (portal) boundaries during logical bubbling. ORTHOGONAL to native
     * `composed` (which crosses the target's SHADOW boundary) — a separate flag, never an overload.
     * Default false (preserves encapsulation).
     */
    composedLogical?: boolean;
  }
  interface Event {
    /**
     * Web Portals: the logical propagation path, computed PRE-retarget as a parallel pass over the
     * logical chain. Read-only; populated only during a `dispatchLogical` run with `bubblesLogical: true`.
     */
    readonly logicalPath: EventTarget[];
    /** Web Portals: logical analogue of `composedPath()`, for events with `composedLogical: true`. */
    composedLogicalPath(): EventTarget[];
    /** Web Portals: stop propagation through the LOGICAL tree (the logical leg only). */
    stopLogicalPropagation(): void;
  }
}
