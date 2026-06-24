/**
 * Reorderable List block — the contract **types** (the WE-resident half of the #1467/#899 split).
 *
 * The runnable reference renderers (`renderReorderableList` + `renderCrossListReorder` and their
 * reducers/announcers/audits) were re-homed to Frontier UI (#920/#1765/#1772): impl → FUI
 * (`@frontierui/blocks/renderers/reorderable-list`), the conformance run stays data-only in WE
 * (`../golden-schema.ts` over the frozen golden corpora). WE keeps only the CONTRACT — these types +
 * the vector corpora (`__fixtures__/{reorderable-list,cross-list-reorder}-cases.ts`) + the committed
 * goldens (`__fixtures__/*-goldens.json`, schema-checked by `../golden-schema.ts`). Mirrors the
 * data-table end-state (#1355/#1531 — `data-table/types.ts`). See
 * `docs/agent/platform-decisions.md#constellation-placement`.
 */

// ── Within-list (Tier-1) ──────────────────────────────────────────────────────

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

// ── Cross-list (Tier-2) ───────────────────────────────────────────────────────

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
