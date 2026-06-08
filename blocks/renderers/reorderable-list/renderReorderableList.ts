/**
 * Reference renderer for the Reorderable List block — the runtime twin of the contract documented at
 * /blocks/reorderable-list/. It realizes the `reorder` intent's **keyboard** path (the mandated
 * headline) over ONE shared source so the demo (the Reorderable List Playground) and CI (the
 * conformance suite) exercise the exact same logic — the same anti-drift split as data-grid /
 * data-table / pagination.
 *
 * Reorder is the *order-is-user-mutable* half of "drag and drop": the item set is unchanged, only its
 * order moves. The keyboard model is **grab-then-move** (consumed verbatim from the WAI-ARIA APG drag
 * guidance and dnd-kit's keyboard sensor):
 *   - Roving tabindex over the items — exactly one item is `tabindex="0"` (the focused item); every
 *     other is `tabindex="-1"`. The concrete consumer of the Focus Delegation intent.
 *   - When nothing is grabbed, ArrowUp/Down (and Left/Right) move the roving focus, Home/End jump to
 *     the ends, clamping at the edges (no wrap).
 *   - Space / Enter on a focused item **grabs** it (fires `reorder-start`).
 *   - While grabbed, ArrowUp/Down move the grabbed item within the order (fires `reorder-move`),
 *     Home/End send it to an end; focus follows the item.
 *   - Space / Enter **drops** it — commits the new order (fires the cancelable `reorder-commit`).
 *   - Escape **cancels** — the order reverts to where the grab began (fires `reorder-cancel`).
 *
 * Keyboard parity is part of the contract, not an add-on: a pointer-only reorderable list is
 * non-conforming. The pointer-drag path and the atomic `Element.moveBefore()` relocation are exercised
 * in the playground's live interactive card; this module's reducer is pure and DOM-free so the
 * keyboard model can't drift between the demo and the conformance suite.
 *
 * Web Everything is the standard: this is a minimal, deterministic reference, NOT the production
 * implementation. Concrete strategies (a real persistence backend, virtualization, cross-list groups)
 * live in Frontier UI / are app-owned. Native DOM only — no framework.
 */

export interface ReorderItem {
  /** Stable identity — survives a move (the order is an array of these ids). */
  id: string;
  /** Visible label. */
  label: string;
}

export interface ReorderConfig {
  /** Whole item draggable (default) vs a scoped handle affordance. */
  grab?: 'whole' | 'handle';
  /** Accessible name for the list. */
  listLabel?: string;
}

/**
 * The reorder session state. `order` is the array of item ids in their current order; `focusIndex` is
 * the roving-tabindex item; `grabbedIndex` is the index the grabbed item currently occupies (-1 when
 * nothing is grabbed); `grabbedFrom` is the index the grab began at (for cancel/commit detail).
 */
export interface ReorderState {
  order: string[];
  focusIndex: number;
  grabbedIndex: number;
  grabbedFrom: number;
}

/** The lifecycle events the reducer emits — mirror the block's documented `reorder-*` events. */
export interface ReorderEvent {
  type: 'reorder-start' | 'reorder-move' | 'reorder-commit' | 'reorder-cancel';
  itemId: string;
  fromIndex: number;
  toIndex?: number;
  /** Present on `reorder-commit` — the full new order at the moment of the drop. */
  order?: string[];
}

/** A reducer step's output: the next state and the event it raised (or null for a no-op). */
export interface ReorderResult {
  state: ReorderState;
  event: ReorderEvent | null;
}

/** Initial state for a row set: original order, focus on the first item, nothing grabbed. */
export function initialState(items: ReorderItem[]): ReorderState {
  return { order: items.map((i) => i.id), focusIndex: 0, grabbedIndex: -1, grabbedFrom: -1 };
}

function clamp(n: number, max: number): number {
  return n < 0 ? 0 : n > max ? max : n;
}

/** Move the element at `from` to `to`, returning a NEW array (the source order is never mutated). */
export function move<T>(arr: readonly T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}

/** Space / Enter both grab-or-drop (KeyboardEvent.key for the spacebar is a literal space). */
function isActionKey(key: string): boolean {
  return key === ' ' || key === 'Space' || key === 'Spacebar' || key === 'Enter';
}
const PREV_KEYS = new Set(['ArrowUp', 'ArrowLeft']);
const NEXT_KEYS = new Set(['ArrowDown', 'ArrowRight']);

/** Keys the reorderable list handles — a demo handler skips everything else (and won't preventDefault). */
export const REORDER_KEYS = new Set([
  ' ', 'Space', 'Spacebar', 'Enter', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End',
]);

/**
 * The grab-then-move keyboard model: given the session state and a key, return the NEW state and the
 * event it raised. Pure and DOM-free — the demo's keydown handler and the conformance suite both call
 * this, so the keyboard model can't drift between them. An unhandled key returns the same state and a
 * null event (the caller skips it).
 */
export function reduceReorder(state: ReorderState, key: string): ReorderResult {
  const n = state.order.length;
  const grabbed = state.grabbedIndex !== -1;
  const noop: ReorderResult = { state, event: null };

  if (!grabbed) {
    const focusedId = state.order[state.focusIndex];
    if (PREV_KEYS.has(key)) return { state: { ...state, focusIndex: clamp(state.focusIndex - 1, n - 1) }, event: null };
    if (NEXT_KEYS.has(key)) return { state: { ...state, focusIndex: clamp(state.focusIndex + 1, n - 1) }, event: null };
    if (key === 'Home') return { state: { ...state, focusIndex: 0 }, event: null };
    if (key === 'End') return { state: { ...state, focusIndex: n - 1 }, event: null };
    if (isActionKey(key)) {
      return {
        state: { ...state, grabbedIndex: state.focusIndex, grabbedFrom: state.focusIndex },
        event: { type: 'reorder-start', itemId: focusedId, fromIndex: state.focusIndex },
      };
    }
    return noop;
  }

  // ── Grabbed: arrows move the grabbed item; Space/Enter drop; Escape cancels. ──
  const cur = state.grabbedIndex;
  const grabbedId = state.order[cur];
  const moveTo = (to: number): ReorderResult => {
    if (to === cur) return noop; // edge clamp — nothing moved
    const order = move(state.order, cur, to);
    return {
      state: { ...state, order, grabbedIndex: to, focusIndex: to },
      event: { type: 'reorder-move', itemId: grabbedId, fromIndex: state.grabbedFrom, toIndex: to },
    };
  };

  if (PREV_KEYS.has(key)) return moveTo(clamp(cur - 1, n - 1));
  if (NEXT_KEYS.has(key)) return moveTo(clamp(cur + 1, n - 1));
  if (key === 'Home') return moveTo(0);
  if (key === 'End') return moveTo(n - 1);
  if (key === 'Escape') {
    const order = move(state.order, cur, state.grabbedFrom);
    return {
      state: { ...state, order, grabbedIndex: -1, grabbedFrom: -1, focusIndex: state.grabbedFrom },
      event: { type: 'reorder-cancel', itemId: grabbedId, fromIndex: state.grabbedFrom },
    };
  }
  if (isActionKey(key)) {
    return {
      state: { ...state, grabbedIndex: -1, grabbedFrom: -1, focusIndex: cur },
      event: { type: 'reorder-commit', itemId: grabbedId, fromIndex: state.grabbedFrom, toIndex: cur, order: state.order.slice() },
    };
  }
  return noop;
}

// ── Announcement — the polite live-region string a screen reader hears (announce dimension) ──────

/**
 * The live-region announcement for an event — the keyboard path's a11y channel that replaces the
 * deprecated aria-grabbed/aria-dropeffect. Shared by the demo's live region and the conformance suite
 * so the wording can't drift.
 */
export function announce(event: ReorderEvent, items: ReorderItem[]): string {
  const n = items.length;
  const labelOf = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const label = labelOf(event.itemId);
  switch (event.type) {
    case 'reorder-start':
      return `Grabbed ${label}. Item ${event.fromIndex + 1} of ${n}. Use the arrow keys to move, Space to drop, Escape to cancel.`;
    case 'reorder-move':
      return `${label}, position ${(event.toIndex ?? 0) + 1} of ${n}.`;
    case 'reorder-commit':
      return event.fromIndex === event.toIndex
        ? `${label} dropped at position ${(event.toIndex ?? 0) + 1} of ${n}.`
        : `${label} moved to position ${(event.toIndex ?? 0) + 1} of ${n}.`;
    case 'reorder-cancel':
      return `Reorder cancelled. ${label} back at position ${event.fromIndex + 1} of ${n}.`;
  }
}

// ── Rendering — project the item set onto a native <ul role="listbox"> at a given state ──────────

function itemEl(item: ReorderItem, index: number, state: ReorderState, config: ReorderConfig): HTMLLIElement {
  const li = document.createElement('li');
  li.setAttribute('role', 'option');
  li.setAttribute('data-reorder-id', item.id);
  li.setAttribute('preserve-on-move', ''); // atomic Element.moveBefore() keeps the card's state
  li.setAttribute('tabindex', index === state.focusIndex ? '0' : '-1');
  if (index === state.grabbedIndex) {
    li.setAttribute('data-reorder-grabbed', ''); // this card is the one being moved (lift it)
    li.setAttribute('data-reorder-target', ''); // and its slot is the candidate landing position
  }

  if (config.grab === 'handle') {
    const handle = document.createElement('span');
    handle.setAttribute('data-reorder-handle', '');
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠇'; // ⠇ braille grab affordance
    li.append(handle);
    li.append(document.createTextNode(' ' + item.label));
  } else {
    li.textContent = item.label;
  }
  return li;
}

/**
 * Render the reorderable list for an item set + config at a given state. Returns a single
 * <ul role="listbox" reorderable> of <li role="option" data-reorder-id preserve-on-move> in
 * `state.order`, with the roving tabindex on `state.focusIndex` and, on the grabbed item (if any),
 * both `data-reorder-grabbed` (the lifted card) and `data-reorder-target` (its slot is the candidate
 * landing position — the gap a theme draws). Defaults to the initial state (original order, focus on
 * the first item).
 */
export function renderReorderableList(
  items: ReorderItem[],
  config: ReorderConfig = {},
  state: ReorderState = initialState(items),
): HTMLUListElement {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ul = document.createElement('ul');
  ul.className = 'reorderable-list';
  ul.setAttribute('reorderable', '');
  ul.setAttribute('role', 'listbox');
  if (config.grab === 'handle') ul.setAttribute('grab', 'handle');
  if (config.listLabel) ul.setAttribute('aria-label', config.listLabel);

  state.order.forEach((id, index) => {
    const item = byId.get(id);
    if (item) ul.append(itemEl(item, index, state, config));
  });
  return ul;
}

/**
 * Reconcile a rendered list's DOM to a state IN PLACE: relocate items to match `state.order` using the
 * atomic `Element.moveBefore()` (falling back to `insertBefore` where unsupported — so a moved card
 * keeps focus/animation/connection state), then refresh the roving tabindex and the grabbed/target
 * markers.
 * Returns the now-focusable item so a caller can `.focus()` it. Used by the live demo on each keystroke
 * without re-rendering — this is where the headline moveBefore substrate is exercised.
 */
export function reconcileOrder(root: HTMLElement, state: ReorderState): HTMLElement | null {
  const moveBefore = (root as unknown as { moveBefore?: (n: Node, ref: Node | null) => void }).moveBefore;
  // Relocate each item into its target slot, in order.
  state.order.forEach((id, index) => {
    const item = root.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`);
    if (!item) return;
    const ref = root.children[index] ?? null;
    if (item !== ref) {
      if (typeof moveBefore === 'function') moveBefore.call(root, item, ref);
      else root.insertBefore(item, ref);
    }
  });
  // Refresh roving tabindex + grabbed marker against the (now correctly ordered) children.
  let focusable: HTMLElement | null = null;
  state.order.forEach((id, index) => {
    const item = root.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`);
    if (!item) return;
    const isFocus = index === state.focusIndex;
    item.setAttribute('tabindex', isFocus ? '0' : '-1');
    if (index === state.grabbedIndex) {
      item.setAttribute('data-reorder-grabbed', '');
      item.setAttribute('data-reorder-target', ''); // the live candidate landing slot — clears on drop/cancel
    } else {
      item.removeAttribute('data-reorder-grabbed');
      item.removeAttribute('data-reorder-target');
    }
    if (isFocus) focusable = item;
  });
  return focusable;
}

// ── Conformance audit — the verified contract, checked by BOTH the demo badge and the CI suite ──

export interface AuditCheck {
  label: string;
  pass: boolean;
}
export interface AuditResult {
  ok: boolean;
  checks: AuditCheck[];
}

/**
 * Audit a rendered reorderable-list root against the verified contract for its item set + state:
 * native grounding (`<ul reorderable role="listbox">` of `role="option"` items, each with a stable
 * `data-reorder-id` and `preserve-on-move`), DOM order matching `state.order`, the roving-tabindex
 * invariant (exactly one item is `tabindex="0"` and it is the focused item; every other is `-1`), and
 * the grabbed marker (exactly the grabbed item carries `data-reorder-grabbed`, or none when nothing is
 * grabbed), and the drop-position marker (exactly one `data-reorder-target` — the candidate landing
 * slot — during a move, none at rest). A bug in the projection, the order, or the roving logic turns
 * this red.
 */
export function auditReorderableList(root: HTMLElement, items: ReorderItem[], state: ReorderState): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });
  const n = state.order.length;

  // ── Native grounding ──
  add('renders a native <ul reorderable role="listbox">',
    root.tagName === 'UL' && root.hasAttribute('reorderable') && root.getAttribute('role') === 'listbox');

  const lis = Array.from(root.querySelectorAll<HTMLElement>(':scope > li'));
  add('every item is a role="option" list item', lis.length === n && lis.every((li) => li.getAttribute('role') === 'option'));
  add('every item carries a stable data-reorder-id', lis.every((li) => !!li.getAttribute('data-reorder-id')));
  add('every item sets preserve-on-move (atomic relocation keeps its state)', lis.every((li) => li.hasAttribute('preserve-on-move')));

  // ── DOM order matches state.order ──
  const domOrder = lis.map((li) => li.getAttribute('data-reorder-id'));
  add('DOM order matches the order model', domOrder.length === n && domOrder.every((id, i) => id === state.order[i]));

  // ── Roving tabindex (the heart of the keyboard contract) ──
  const focusable = lis.filter((li) => li.getAttribute('tabindex') === '0');
  add('exactly one item is tabindex="0" (roving tabindex)', focusable.length === 1);
  add('every other item is tabindex="-1"', lis.filter((li) => li.getAttribute('tabindex') === '-1').length === Math.max(0, lis.length - 1));
  add(`the focusable item is the focused item (index ${state.focusIndex})`,
    focusable.length === 1 && focusable[0].getAttribute('data-reorder-id') === state.order[state.focusIndex]);

  // ── Grabbed marker (no deprecated aria-grabbed) ──
  const grabbedEls = lis.filter((li) => li.hasAttribute('data-reorder-grabbed'));
  if (state.grabbedIndex === -1) {
    add('no item is marked grabbed when nothing is grabbed', grabbedEls.length === 0);
  } else {
    add('exactly the grabbed item carries data-reorder-grabbed',
      grabbedEls.length === 1 && grabbedEls[0].getAttribute('data-reorder-id') === state.order[state.grabbedIndex]);
  }

  // ── Drop-position marker — the candidate landing slot (the gap a theme draws) ──
  // The reference relocates the grabbed item live, so its slot IS the drop target: exactly one
  // [data-reorder-target] during a move, none at rest.
  const targetEls = lis.filter((li) => li.hasAttribute('data-reorder-target'));
  if (state.grabbedIndex === -1) {
    add('no item is marked the drop target at rest', targetEls.length === 0);
  } else {
    add('exactly one item marks the drop position (data-reorder-target) during a move',
      targetEls.length === 1 && targetEls[0].getAttribute('data-reorder-id') === state.order[state.grabbedIndex]);
  }

  return { ok: checks.every((c) => c.pass), checks };
}
