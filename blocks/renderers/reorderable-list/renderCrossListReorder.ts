/**
 * Reference implementation for the Reorderable List block's Tier-2 **cross-list** scope —
 * `withCrossListReorder` (`reorder.scope.cross-list`), the runtime twin of the contract at
 * /blocks/reorderable-list/. It adds the one capability the within-list engine
 * (`renderReorderableList.ts`, backlog #130) deliberately scoped out: moving an item from one list
 * into a **sibling list** that shares a group key (`reorder-group="…"`) — the pattern SortableJS
 * exposes as cross-list groups.
 *
 * This is the **seam** with the data-transfer family (backlog #007), so the contract is explicit:
 * cross-list reorder is "move semantics WITHIN the app" — it relocates an item between two lists the
 * app already owns. It is NOT OS-level `DataTransfer` (dragging files in, dragging across windows);
 * that stays #007's call, and `reorder` composes with a future `drag-source`/`drop-target` rather
 * than overlapping it.
 *
 * Built ON the within-list engine, not forked from it: the order model becomes **per-list** (an array
 * of `{ id, label, order }`), and vertical movement of a grabbed item *inside* a list still delegates
 * to `reduceReorder` — the within-list reducer is the inner loop. What's new is the cross-list axis:
 *   - **Roving tabindex spans the whole group** — exactly one item across all sibling lists is
 *     `tabindex="0"`; Left/Right move the roving focus (and a grabbed item) between sibling lists,
 *     ArrowUp/Down still move within the active list (the Kanban-column convention).
 *   - A grabbed item **pops out** of its source list's order and **splices into** the target list's
 *     order at the drop index — both the keyboard path (Left/Right) and the pointer path (`relocate`).
 *   - Cancel reverts across lists (the item returns to the list AND index the grab began in); commit
 *     fires the cancelable `reorder-commit` carrying every list's final order.
 *
 * Keyboard parity is still part of the contract, not an add-on. Native DOM only — no framework. This
 * is a minimal, deterministic reference; production strategies live in Frontier UI.
 */

import {
  reduceReorder,
  REORDER_KEYS,
  type ReorderItem,
  type ReorderState,
} from './renderReorderableList';

export type { ReorderItem };
export { REORDER_KEYS };

/** One list in a cross-list group: a stable identity, a visible label, and its current item order. */
export interface ReorderList {
  /** Stable list identity — the `reorder-group` member key (survives moves into/out of the list). */
  id: string;
  /** Accessible name for the list (used in announcements and as the list's `aria-label`). */
  label: string;
  /** Item ids in this list's current order. */
  order: string[];
}

export interface CrossListConfig {
  /** The shared group key binding these sibling lists into one drag group. */
  group: string;
  /** Whole item draggable (default) vs a scoped handle affordance. */
  grab?: 'whole' | 'handle';
}

/**
 * The cross-list reorder session state. The order model is **per-list**; `activeList` is the list the
 * roving focus / grab currently sits in; `focusIndex` is the roving index within that list;
 * `grabbedIndex` is the index the grabbed item occupies in the active list (-1 when nothing is
 * grabbed); `grabbedFromList` / `grabbedFromIndex` record where the grab began (for cancel/commit).
 */
export interface CrossListState {
  lists: ReorderList[];
  activeList: number;
  focusIndex: number;
  grabbedIndex: number;
  grabbedFromList: number;
  grabbedFromIndex: number;
}

/** The lifecycle events the cross-list reducer emits — the cross-list twin of the within-list set. */
export interface CrossListEvent {
  type: 'reorder-start' | 'reorder-move' | 'reorder-commit' | 'reorder-cancel';
  itemId: string;
  /** The list the grab began in. */
  fromList: number;
  /** The index the grab began at within `fromList`. */
  fromIndex: number;
  /** The list the item now sits in (move/commit). */
  toList?: number;
  /** The index the item now sits at within `toList` (move/commit). */
  toIndex?: number;
  /** True when this step changed lists (the cross-list axis) — drives the announcement wording. */
  crossed?: boolean;
  /** Present on `reorder-commit` — each list id mapped to its full order at the moment of the drop. */
  orders?: Record<string, string[]>;
}

export interface CrossListResult {
  state: CrossListState;
  event: CrossListEvent | null;
}

/** Initial state for a group: original per-list orders, focus on the first item of the first list. */
export function initialCrossListState(lists: ReorderList[]): CrossListState {
  return {
    lists: lists.map((l) => ({ ...l, order: l.order.slice() })),
    activeList: 0,
    focusIndex: 0,
    grabbedIndex: -1,
    grabbedFromList: -1,
    grabbedFromIndex: -1,
  };
}

function clamp(n: number, max: number): number {
  return n < 0 ? 0 : n > max ? max : n;
}

function isActionKey(key: string): boolean {
  return key === ' ' || key === 'Space' || key === 'Spacebar' || key === 'Enter';
}

/**
 * Relocate the grabbed item out of the active list and into `toList` at `rawIndex` (clamped into the
 * target's range — `rawIndex === length` appends). The free-movement primitive both the keyboard
 * cross-list path (Left/Right) and the pointer path call: with `toList === activeList` it is an
 * in-list move, otherwise a cross-list move. Returns the same state + a null event for a no-op (no
 * grab, or the item would land back where it started). Pure — never mutates the source state.
 */
export function relocate(state: CrossListState, toList: number, rawIndex: number): CrossListResult {
  const noop: CrossListResult = { state, event: null };
  if (state.grabbedIndex === -1) return noop;
  const fromList = state.activeList;
  const grabbedId = state.lists[fromList].order[state.grabbedIndex];
  if (grabbedId === undefined) return noop;

  const sameList = toList === fromList;
  const srcOrder = state.lists[fromList].order.slice();
  srcOrder.splice(state.grabbedIndex, 1);
  const dstOrder = sameList ? srcOrder : state.lists[toList].order.slice();
  const toIndex = clamp(rawIndex, dstOrder.length);
  if (sameList && toIndex === state.grabbedIndex) return noop; // landed where it started
  dstOrder.splice(toIndex, 0, grabbedId);

  const lists = state.lists.map((l, i) => {
    if (sameList) return i === fromList ? { ...l, order: dstOrder } : l;
    if (i === fromList) return { ...l, order: srcOrder };
    if (i === toList) return { ...l, order: dstOrder };
    return l;
  });

  return {
    state: { ...state, lists, activeList: toList, grabbedIndex: toIndex, focusIndex: toIndex },
    event: {
      type: 'reorder-move',
      itemId: grabbedId,
      fromList: state.grabbedFromList,
      fromIndex: state.grabbedFromIndex,
      toList,
      toIndex,
      crossed: !sameList,
    },
  };
}

/**
 * The cross-list grab-then-move keyboard model: given the session state and a key, return the NEW
 * state and the event it raised. Pure and DOM-free — the demo's keydown handler and the conformance
 * suite both call this, so the keyboard model can't drift between them.
 *
 *   - When nothing is grabbed: ArrowUp/Down move the roving focus within the active list (delegated to
 *     the within-list reducer); Left/Right move it to the previous/next sibling list (clamping the
 *     index into the target's range); Home/End jump within the active list. All clamp at the edges.
 *   - Space/Enter on a focused item **grabs** it (`reorder-start`).
 *   - While grabbed: ArrowUp/Down move it within the active list (`reorder-move`, delegated);
 *     Left/Right move it to the sibling list at the same slot (`reorder-move`, crossed); Space/Enter
 *     **drop** it (the cancelable `reorder-commit`); Escape **cancels** — it returns to the list AND
 *     index the grab began in (`reorder-cancel`).
 *
 * An unhandled key (or a clamped no-op) returns the same state and a null event.
 */
export function reduceCrossListReorder(state: CrossListState, key: string): CrossListResult {
  const noop: CrossListResult = { state, event: null };
  const grabbed = state.grabbedIndex !== -1;

  // ── Cross-list axis: Left/Right move focus (or the grabbed item) between sibling lists. ──
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const target = clamp(state.activeList + (key === 'ArrowLeft' ? -1 : 1), state.lists.length - 1);
    if (target === state.activeList) return noop; // at the group edge — no sibling that way
    if (grabbed) return relocate(state, target, state.grabbedIndex); // keep the same slot in the target
    const len = state.lists[target].order.length;
    return { state: { ...state, activeList: target, focusIndex: len === 0 ? 0 : clamp(state.focusIndex, len - 1) }, event: null };
  }

  const active = state.lists[state.activeList];

  // ── Grab — Space/Enter on the focused item lifts it. ──
  if (isActionKey(key) && !grabbed) {
    const id = active.order[state.focusIndex];
    if (id === undefined) return noop; // focused an empty list
    return {
      state: { ...state, grabbedIndex: state.focusIndex, grabbedFromList: state.activeList, grabbedFromIndex: state.focusIndex },
      event: { type: 'reorder-start', itemId: id, fromList: state.activeList, fromIndex: state.focusIndex },
    };
  }

  // ── Commit — Space/Enter while grabbed drops it, snapshotting every list's order. ──
  if (isActionKey(key) && grabbed) {
    const id = active.order[state.grabbedIndex];
    return {
      state: { ...state, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1, focusIndex: state.grabbedIndex },
      event: {
        type: 'reorder-commit',
        itemId: id,
        fromList: state.grabbedFromList,
        fromIndex: state.grabbedFromIndex,
        toList: state.activeList,
        toIndex: state.grabbedIndex,
        crossed: state.grabbedFromList !== state.activeList,
        orders: Object.fromEntries(state.lists.map((l) => [l.id, l.order.slice()])),
      },
    };
  }

  // ── Cancel — Escape while grabbed returns the item to the list+index the grab began in. ──
  if (key === 'Escape' && grabbed) {
    const id = active.order[state.grabbedIndex];
    const lists = state.lists.map((l) => ({ ...l, order: l.order.slice() }));
    lists[state.activeList].order.splice(state.grabbedIndex, 1);
    lists[state.grabbedFromList].order.splice(state.grabbedFromIndex, 0, id);
    return {
      state: { ...state, lists, activeList: state.grabbedFromList, focusIndex: state.grabbedFromIndex, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
      event: { type: 'reorder-cancel', itemId: id, fromList: state.grabbedFromList, fromIndex: state.grabbedFromIndex },
    };
  }

  // ── Within-list axis: delegate ArrowUp/Down/Home/End to the within-list engine (the inner loop). ──
  if (!REORDER_KEYS.has(key)) return noop;
  const slice: ReorderState = { order: active.order, focusIndex: state.focusIndex, grabbedIndex: state.grabbedIndex, grabbedFrom: state.grabbedIndex };
  const r = reduceReorder(slice, key);
  const lists = state.lists.map((l, i) => (i === state.activeList ? { ...l, order: r.state.order } : l));
  const next: CrossListState = { ...state, lists, focusIndex: r.state.focusIndex, grabbedIndex: r.state.grabbedIndex };
  if (!r.event) return { state: next, event: null }; // focus rove or clamped no-op
  // The within-list reducer only raises reorder-move here; re-stamp it with the cross-list origin.
  return {
    state: next,
    event: {
      type: 'reorder-move',
      itemId: r.event.itemId,
      fromList: state.grabbedFromList,
      fromIndex: state.grabbedFromIndex,
      toList: state.activeList,
      toIndex: r.event.toIndex,
      crossed: false,
    },
  };
}

// ── Announcement — the polite live-region string for a cross-list event ──────────────────────────

/**
 * The live-region announcement for a cross-list event — the keyboard path's a11y channel. Reads the
 * state AFTER the event (so positions and counts reflect the move). A cross-list move names the target
 * list ("Moved X to list Done, position 2 of 3"); an in-list move keeps the within-list wording.
 * Shared by the demo's live region and the conformance suite so the wording can't drift.
 */
export function announceCrossList(event: CrossListEvent, state: CrossListState, items: ReorderItem[]): string {
  const labelOf = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const listName = (i: number | undefined) => state.lists[i ?? -1]?.label ?? 'a list';
  const label = labelOf(event.itemId);
  const toCount = (i: number | undefined) => state.lists[i ?? -1]?.order.length ?? 0;
  switch (event.type) {
    case 'reorder-start':
      return `Grabbed ${label} in ${listName(event.fromList)}. Item ${event.fromIndex + 1} of ${toCount(event.fromList)}. Arrow keys move it within the list; Left and Right move it between lists; Space to drop, Escape to cancel.`;
    case 'reorder-move':
      return event.crossed
        ? `Moved ${label} to list ${listName(event.toList)}, position ${(event.toIndex ?? 0) + 1} of ${toCount(event.toList)}.`
        : `${label}, position ${(event.toIndex ?? 0) + 1} of ${toCount(event.toList)}.`;
    case 'reorder-commit':
      return event.crossed
        ? `${label} moved to list ${listName(event.toList)}, position ${(event.toIndex ?? 0) + 1} of ${toCount(event.toList)}.`
        : `${label} dropped at position ${(event.toIndex ?? 0) + 1} of ${toCount(event.toList)} in ${listName(event.toList)}.`;
    case 'reorder-cancel':
      return `Reorder cancelled. ${label} back in ${listName(event.fromList)} at position ${event.fromIndex + 1}.`;
  }
}

// ── Rendering — project a cross-list group onto sibling <ul role="listbox"> lists ────────────────

function itemEl(item: ReorderItem, isFocus: boolean, isGrabbed: boolean, config: CrossListConfig): HTMLLIElement {
  const li = document.createElement('li');
  li.setAttribute('role', 'option');
  li.setAttribute('data-reorder-id', item.id);
  li.setAttribute('preserve-on-move', ''); // atomic Element.moveBefore() keeps the card's state across lists
  li.setAttribute('tabindex', isFocus ? '0' : '-1');
  if (isGrabbed) li.setAttribute('data-reorder-grabbed', '');

  if (config.grab === 'handle') {
    const handle = document.createElement('span');
    handle.setAttribute('data-reorder-handle', '');
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠇';
    li.append(handle);
    li.append(document.createTextNode(' ' + item.label));
  } else {
    li.textContent = item.label;
  }
  return li;
}

function listEl(list: ReorderList, listIndex: number, byId: Map<string, ReorderItem>, config: CrossListConfig, state: CrossListState): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'reorderable-list';
  ul.setAttribute('reorderable', '');
  ul.setAttribute('role', 'listbox');
  ul.setAttribute('scope', 'cross-list');
  ul.setAttribute('reorder-group', config.group);
  ul.setAttribute('data-list-id', list.id);
  ul.setAttribute('aria-label', list.label);
  if (config.grab === 'handle') ul.setAttribute('grab', 'handle');

  const isActive = listIndex === state.activeList;
  // Option A — an empty active list keeps the group's single tabstop on its own container, so Tab
  // still lands in the widget and Space/Arrows have an "insert here" target (it already has
  // role="listbox"). When the active list has items, the tabstop rides the focused item instead.
  if (isActive && list.order.length === 0) ul.setAttribute('tabindex', '0');
  list.order.forEach((id, index) => {
    const item = byId.get(id);
    if (!item) return;
    const isFocus = isActive && index === state.focusIndex;
    const isGrabbed = isActive && index === state.grabbedIndex;
    ul.append(itemEl(item, isFocus, isGrabbed, config));
  });
  return ul;
}

/**
 * Render a cross-list reorder group for an item set + config at a given state. Returns a single
 * `<div class="reorder-group" data-reorder-group>` wrapping one `<ul reorderable role="listbox"
 * scope="cross-list" reorder-group>` per list, each with its items in `state.lists[i].order`. Exactly
 * one tabstop spans the WHOLE group — the focused item in the active list, or, when the active list is
 * empty, that list's `<ul>` container (Option A); the grabbed item carries `data-reorder-grabbed`.
 * Defaults to the initial state.
 */
export function renderCrossListReorder(
  lists: ReorderList[],
  items: ReorderItem[],
  config: CrossListConfig,
  state: CrossListState = initialCrossListState(lists),
): HTMLDivElement {
  const byId = new Map(items.map((i) => [i.id, i]));
  const group = document.createElement('div');
  group.className = 'reorder-group';
  group.setAttribute('data-reorder-group', config.group);
  state.lists.forEach((list, i) => group.append(listEl(list, i, byId, config, state)));
  return group;
}

/**
 * Reconcile a rendered group's DOM to a state IN PLACE: relocate each item into its target list and
 * slot using the atomic `Element.moveBefore()` (across lists too — falling back to `insertBefore`),
 * then refresh the group-wide roving tabindex and the grabbed marker. Returns the now-focusable item.
 * Used by the live demo on each keystroke without re-rendering.
 */
export function reconcileCrossList(root: HTMLElement, state: CrossListState): HTMLElement | null {
  const moveBefore = (el: HTMLElement, node: Node, ref: Node | null) => {
    const mb = (el as unknown as { moveBefore?: (n: Node, r: Node | null) => void }).moveBefore;
    if (typeof mb === 'function') mb.call(el, node, ref);
    else el.insertBefore(node, ref);
  };

  // Relocate every item into its list + slot, in order (pulling the node from wherever it currently is).
  state.lists.forEach((list) => {
    const ul = root.querySelector<HTMLElement>(`[data-list-id="${list.id}"]`);
    if (!ul) return;
    list.order.forEach((id, index) => {
      const item = root.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`);
      if (!item) return;
      const ref = ul.children[index] ?? null;
      if (item !== ref) moveBefore(ul, item, ref);
    });
  });

  // Refresh the group-wide roving tabindex + grabbed marker against the (now correctly placed) items.
  let focusable: HTMLElement | null = null;
  state.lists.forEach((list, li) => {
    const isActive = li === state.activeList;
    list.order.forEach((id, index) => {
      const item = root.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`);
      if (!item) return;
      const isFocus = isActive && index === state.focusIndex;
      item.setAttribute('tabindex', isFocus ? '0' : '-1');
      if (isActive && index === state.grabbedIndex) item.setAttribute('data-reorder-grabbed', '');
      else item.removeAttribute('data-reorder-grabbed');
      if (isFocus) focusable = item;
    });
  });

  // Option A — when the active list is empty no item can carry the tabstop, so it rides the active
  // list's container instead; every other <ul> drops any container tabstop a prior state left behind.
  state.lists.forEach((list, li) => {
    const ul = root.querySelector<HTMLElement>(`[data-list-id="${list.id}"]`);
    if (!ul) return;
    if (li === state.activeList && list.order.length === 0) {
      ul.setAttribute('tabindex', '0');
      focusable = ul;
    } else {
      ul.removeAttribute('tabindex');
    }
  });
  return focusable;
}

// ── Conformance audit — the verified cross-list contract, checked by BOTH the demo and the CI suite ─

export interface AuditCheck {
  label: string;
  pass: boolean;
}
export interface AuditResult {
  ok: boolean;
  checks: AuditCheck[];
}

/**
 * Audit a rendered cross-list group against the verified contract for its lists + state: a
 * `data-reorder-group` wrapper of sibling `<ul reorderable role="listbox" scope="cross-list"
 * reorder-group>` lists (all sharing the one group key), each list's items grounded as before
 * (`role="option"` with a stable `data-reorder-id` + `preserve-on-move`) and in its order-model order,
 * the GROUP-WIDE roving-tabindex invariant (exactly one tabstop across all lists — the active list's
 * focused item, or, when the active list is empty, that list's `<ul>` container per Option A; every
 * other item is `-1`), and the grabbed marker (exactly the grabbed
 * item carries `data-reorder-grabbed`, or none when nothing is grabbed).
 */
export function auditCrossListReorder(root: HTMLElement, items: ReorderItem[], state: CrossListState, config: CrossListConfig): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });

  // ── Group grounding ──
  add('renders a data-reorder-group wrapper', root.getAttribute('data-reorder-group') === config.group);
  const uls = Array.from(root.querySelectorAll<HTMLElement>(':scope > ul'));
  add('one <ul> per list in the model', uls.length === state.lists.length);
  add('every list is a native <ul reorderable role="listbox" scope="cross-list">',
    uls.every((ul) => ul.tagName === 'UL' && ul.hasAttribute('reorderable') && ul.getAttribute('role') === 'listbox' && ul.getAttribute('scope') === 'cross-list'));
  add('every list shares the one reorder-group key', uls.every((ul) => ul.getAttribute('reorder-group') === config.group));

  // ── Per-list grounding + order ──
  let itemsGrounded = true;
  let orderMatches = true;
  state.lists.forEach((list) => {
    const ul = uls.find((u) => u.getAttribute('data-list-id') === list.id) ?? null;
    if (!ul) { itemsGrounded = false; orderMatches = false; return; }
    const lis = Array.from(ul.querySelectorAll<HTMLElement>(':scope > li'));
    if (lis.length !== list.order.length) itemsGrounded = false;
    if (!lis.every((li) => li.getAttribute('role') === 'option' && !!li.getAttribute('data-reorder-id') && li.hasAttribute('preserve-on-move'))) itemsGrounded = false;
    const domOrder = lis.map((li) => li.getAttribute('data-reorder-id'));
    if (!(domOrder.length === list.order.length && domOrder.every((id, i) => id === list.order[i]))) orderMatches = false;
  });
  add('every item is a role="option" with a stable data-reorder-id and preserve-on-move', itemsGrounded);
  add('each list\'s DOM order matches its order model', orderMatches);

  // ── Group-wide roving tabindex (Option A: exactly one tabstop across the group — the active list's
  //    focused item, or, when the active list is empty, the active list's <ul> container) ──
  const allLis = Array.from(root.querySelectorAll<HTMLElement>('li[data-reorder-id]'));
  const focusable = allLis.filter((li) => li.getAttribute('tabindex') === '0');
  const focusableUls = uls.filter((ul) => ul.getAttribute('tabindex') === '0');
  const activeList = state.lists[state.activeList];
  const activeEmpty = !!activeList && activeList.order.length === 0;
  if (activeEmpty) {
    add('the empty active list keeps the single group tabstop on its container',
      focusable.length === 0 && focusableUls.length === 1 && focusableUls[0].getAttribute('data-list-id') === activeList.id);
    add('no item carries a tabstop while the active list is empty',
      allLis.every((li) => li.getAttribute('tabindex') === '-1'));
  } else {
    add('exactly one item across the whole group is tabindex="0" (group-wide roving tabindex)', focusable.length === 1);
    add('every other item is tabindex="-1"', allLis.filter((li) => li.getAttribute('tabindex') === '-1').length === Math.max(0, allLis.length - 1));
    add('no list container holds a tabstop while an item carries it', focusableUls.length === 0);
    const focusedId = activeList?.order[state.focusIndex];
    add(`the focusable item is the active list's focused item`,
      focusable.length === 1 && focusable[0].getAttribute('data-reorder-id') === focusedId);
  }

  // ── Grabbed marker ──
  const grabbedEls = allLis.filter((li) => li.hasAttribute('data-reorder-grabbed'));
  if (state.grabbedIndex === -1) {
    add('no item is marked grabbed when nothing is grabbed', grabbedEls.length === 0);
  } else {
    const grabbedId = state.lists[state.activeList]?.order[state.grabbedIndex];
    add('exactly the grabbed item carries data-reorder-grabbed', grabbedEls.length === 1 && grabbedEls[0].getAttribute('data-reorder-id') === grabbedId);
  }

  return { ok: checks.every((c) => c.pass), checks };
}
