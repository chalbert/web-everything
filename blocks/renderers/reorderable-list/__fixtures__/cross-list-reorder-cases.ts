/**
 * Shared cross-list reorder fixtures — the single source of the example cases for BOTH the Reorderable
 * List Playground's cross-list section and the conformance suite, so the demo's green badges are
 * CI-backed (the anti-drift split, as for the within-list cases).
 *
 * Each case pairs a per-list order model with a key sequence (the **grab-then-move** model, extended
 * with Left/Right to cross between sibling lists) and the state that sequence should leave the group
 * in — proving one rule (cross-list focus, cross-list move, in-list move after a cross, commit,
 * cancel-reverts-across-lists, group-edge clamp, append into a sibling). The reducer
 * (reduceCrossListReorder), the renderer, the announcer (announceCrossList), and the audit
 * (auditCrossListReorder) are the one shared source both surfaces run. `expectedAnnounce` is the
 * live-region string of the LAST event the sequence raised ('' when none) — double-entry against the
 * announcer, evaluated against the FINAL state.
 */
import type { ReorderItem } from '../renderCrossListReorder';
import type { CrossListState, ReorderList } from '../renderCrossListReorder';

export interface CrossListReorderCase {
  id: string;
  title: string;
  note?: string;
  /** The flat item set (label lookup) spread across the lists. */
  items: ReorderItem[];
  /** The initial per-list order model. */
  lists: ReorderList[];
  /** Keys pressed from the initial state (focus on the first item of the first list, nothing grabbed). */
  keys: string[];
  /** The state the sequence should leave the group in — double-entry against the reducer. */
  expected: CrossListState;
  /** The live-region string of the last event raised, against the final state ('' if none). */
  expectedAnnounce: string;
}

// A small Kanban-flavoured corpus — 4 cards across three sibling lists, ids stable across moves.
const ITEMS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'ship', label: 'Ship it' },
];

/** Fresh initial lists per case (the reducer copies, but each case owns its own arrays for clarity). */
const lists = (): ReorderList[] => [
  { id: 'todo', label: 'Todo', order: ['spec', 'build'] },
  { id: 'doing', label: 'Doing', order: ['test'] },
  { id: 'done', label: 'Done', order: ['ship'] },
];

const L = (todo: string[], doing: string[], done: string[]): ReorderList[] => [
  { id: 'todo', label: 'Todo', order: todo },
  { id: 'doing', label: 'Doing', order: doing },
  { id: 'done', label: 'Done', order: done },
];

export const crossListReorderCases: CrossListReorderCase[] = [
  {
    id: 'initial',
    title: '1 · Initial focus — the first item of the first list',
    note: 'On render, exactly one item across the WHOLE group is tabindex="0": the first item of the first list. Nothing is grabbed; the roving tabindex spans all sibling lists.',
    items: ITEMS,
    lists: lists(),
    keys: [],
    expected: { lists: L(['spec', 'build'], ['test'], ['ship']), activeList: 0, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'cross-focus',
    title: '2 · Arrow Right — move the roving focus to the next list',
    note: 'With nothing grabbed, ArrowRight moves the roving focus to the next sibling list (Todo → Doing), clamping the index into the target list\'s range. No order changes.',
    items: ITEMS,
    lists: lists(),
    keys: ['ArrowRight'],
    expected: { lists: L(['spec', 'build'], ['test'], ['ship']), activeList: 1, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'edge-clamp-left',
    title: '3 · Edge clamp — Arrow Left at the first list is a no-op',
    note: 'The cross-list axis clamps at the group edges (no wrap). At the first list, ArrowLeft has no sibling to move to: focus stays put and no event fires.',
    items: ITEMS,
    lists: lists(),
    keys: ['ArrowLeft'],
    expected: { lists: L(['spec', 'build'], ['test'], ['ship']), activeList: 0, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'cross-move',
    title: '4 · Grab, then Arrow Right — move the item into the next list (headline)',
    note: 'The headline cross-list move: grab the first card in Todo, ArrowRight pops it out of Todo and splices it into Doing at the same slot. The order model is now per-list; the announcement names the target list.',
    items: ITEMS,
    lists: lists(),
    keys: ['Space', 'ArrowRight'],
    expected: { lists: L(['build'], ['spec', 'test'], ['ship']), activeList: 1, focusIndex: 0, grabbedIndex: 0, grabbedFromList: 0, grabbedFromIndex: 0 },
    expectedAnnounce: 'Moved Write the spec to list Doing, position 1 of 2.',
  },
  {
    id: 'cross-then-within',
    title: '5 · Cross, then Arrow Down — move within the new list',
    note: 'After crossing into Doing, ArrowDown moves the grabbed item DOWN within Doing (delegated to the within-list engine — the inner loop). The announcement drops back to the in-list wording.',
    items: ITEMS,
    lists: lists(),
    keys: ['Space', 'ArrowRight', 'ArrowDown'],
    expected: { lists: L(['build'], ['test', 'spec'], ['ship']), activeList: 1, focusIndex: 1, grabbedIndex: 1, grabbedFromList: 0, grabbedFromIndex: 0 },
    expectedAnnounce: 'Write the spec, position 2 of 2.',
  },
  {
    id: 'cross-commit',
    title: '6 · Grab, cross, drop — commit the cross-list move',
    note: 'Grab in Todo, cross into Doing, drop. The cancelable reorder-commit fires carrying every list\'s final order; the grab is released. The announcement confirms the destination list.',
    items: ITEMS,
    lists: lists(),
    keys: ['Space', 'ArrowRight', 'Enter'],
    expected: { lists: L(['build'], ['spec', 'test'], ['ship']), activeList: 1, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: 'Write the spec moved to list Doing, position 1 of 2.',
  },
  {
    id: 'cross-cancel',
    title: '7 · Grab, cross, Escape — cancel reverts across lists',
    note: 'Escape while grabbed cancels: the item returns to the list AND index the grab began in (Todo, position 1), not just the list it currently sits in. The whole group is back to the original model.',
    items: ITEMS,
    lists: lists(),
    keys: ['Space', 'ArrowRight', 'Escape'],
    expected: { lists: L(['spec', 'build'], ['test'], ['ship']), activeList: 0, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: 'Reorder cancelled. Write the spec back in Todo at position 1.',
  },
  {
    id: 'cross-append',
    title: '8 · Grab a later item, cross twice — append into the last list',
    note: 'Focus the second Todo card, grab it, then ArrowRight twice. Each cross keeps the item\'s slot index, clamped into the target — landing it appended at the end of Done.',
    items: ITEMS,
    lists: lists(),
    keys: ['ArrowDown', 'Space', 'ArrowRight', 'ArrowRight'],
    expected: { lists: L(['spec'], ['test'], ['ship', 'build']), activeList: 2, focusIndex: 1, grabbedIndex: 1, grabbedFromList: 0, grabbedFromIndex: 1 },
    expectedAnnounce: 'Moved Build the block to list Done, position 2 of 2.',
  },
  {
    id: 'empty-source',
    title: '9 · Empty a list — move its only card out, leaving the source <ul> empty',
    note: 'Rove into Doing (its single card), grab it, cross it into Done and drop. Doing ends EMPTY and the group still audits clean: the group-wide roving tabindex sits in Done, and the now-empty Doing <ul> stays grounded as a valid (zero-item) list. The emptied edge of the cross-list model, pinned.',
    items: ITEMS,
    lists: lists(),
    keys: ['ArrowRight', 'Space', 'ArrowRight', 'Enter'],
    expected: { lists: L(['spec', 'build'], [], ['test', 'ship']), activeList: 2, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: 'Add the conformance test moved to list Done, position 1 of 2.',
  },
  {
    id: 'cross-into-empty',
    title: '10 · Cross into an empty list — land at position 1',
    note: 'Start with an empty Doing list (Done already holds the moved-out cards). Grab the first Todo card and ArrowRight into the empty Doing: the drop index clamps into the zero-length target, so it lands at position 1 and the announcement names the now-one-card Doing. The empty-target edge of the cross-list move.',
    items: ITEMS,
    lists: L(['spec', 'build'], [], ['test', 'ship']),
    keys: ['Space', 'ArrowRight'],
    expected: { lists: L(['build'], ['spec'], ['test', 'ship']), activeList: 1, focusIndex: 0, grabbedIndex: 0, grabbedFromList: 0, grabbedFromIndex: 0 },
    expectedAnnounce: 'Moved Write the spec to list Doing, position 1 of 1.',
  },
  {
    id: 'rove-through-empty',
    title: '11 · Rove focus through an empty list and out the far side',
    note: 'With nothing grabbed, ArrowRight twice crosses an empty Doing list and lands on Done. Passing through the empty column clamps focusIndex to 0 (nothing focusable while it is the active list); roving on restores the single group-wide tabstop in Done. The focus-into/out-of-empty edge — the resting state audits clean.',
    items: ITEMS,
    lists: L(['spec', 'build'], [], ['test', 'ship']),
    keys: ['ArrowRight', 'ArrowRight'],
    expected: { lists: L(['spec', 'build'], [], ['test', 'ship']), activeList: 2, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'rest-on-empty',
    title: '12 · Rest on an empty list — the tabstop rides the empty list container',
    note: 'With nothing grabbed, ArrowRight once parks the roving focus ON the empty Doing list. No item can carry the group tabstop, so it moves to Doing\'s <ul role="listbox"> container (Option A) — the group still has exactly one tabstop, Tab lands in the widget, and the resting state audits clean. The empty-active-list edge, pinned (#154).',
    items: ITEMS,
    lists: L(['spec', 'build'], [], ['test', 'ship']),
    keys: ['ArrowRight'],
    expected: { lists: L(['spec', 'build'], [], ['test', 'ship']), activeList: 1, focusIndex: 0, grabbedIndex: -1, grabbedFromList: -1, grabbedFromIndex: -1 },
    expectedAnnounce: '',
  },
];
