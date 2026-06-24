/**
 * Shared Reorderable List fixtures — the single source of the example cases for BOTH the Reorderable
 * List Playground demo and the conformance suite, so the demo's green badges are CI-backed (the
 * anti-drift split, mirroring the data-grid / data-table / pagination fixtures).
 *
 * Each case pairs an item set with a key sequence (the **grab-then-move** keyboard model) and the state
 * that sequence should leave the list in — proving one rule (roving focus, grab, move, drop/commit,
 * cancel/revert, edge clamp). The reference renderer + reducer + announcer + audit are FUI-canonical
 * (#1772: impl → `@frontierui/blocks/renderers/reorderable-list`); WE keeps this vector corpus as the
 * contract, validated data-only via the committed goldens (`./reorderable-list-goldens.json`,
 * `../golden-schema.ts`). `expectedAnnounce` is the live-region string of the LAST event the sequence
 * raised ('' when no event fired) — double-entry against the announcer.
 */
import type { ReorderItem, ReorderState } from '../types';

export interface ReorderableListCase {
  id: string;
  title: string;
  note?: string;
  items: ReorderItem[];
  /** Keys pressed from the initial state (focus on the first item, nothing grabbed). */
  keys: string[];
  /** The state the sequence should leave the list in — double-entry against the reducer. */
  expected: ReorderState;
  /** The live-region string of the last event raised ('' if the sequence raised none). */
  expectedAnnounce: string;
}

// A small backlog-flavoured corpus — 5 items, ids stable across moves.
const TASKS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'demo', label: 'Wire the playground' },
  { id: 'ship', label: 'Ship it' },
];
const order = (...ids: string[]) => ids;

export const reorderableListCases: ReorderableListCase[] = [
  {
    id: 'initial',
    title: '1 · Initial focus — the first item',
    note: 'On render, exactly one item is tabindex="0": the first item. Nothing is grabbed. Every other item is tabindex="-1" — the roving tabindex, the keyboard path\'s foundation.',
    items: TASKS,
    keys: [],
    expected: { order: order('spec', 'build', 'test', 'demo', 'ship'), focusIndex: 0, grabbedIndex: -1, grabbedFrom: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'rove',
    title: '2 · Arrow Down — move the roving focus (not grabbed)',
    note: 'With nothing grabbed, ArrowDown moves the roving focus down the list without changing the order. Two presses land focus on the third item; the order is untouched.',
    items: TASKS,
    keys: ['ArrowDown', 'ArrowDown'],
    expected: { order: order('spec', 'build', 'test', 'demo', 'ship'), focusIndex: 2, grabbedIndex: -1, grabbedFrom: -1 },
    expectedAnnounce: '',
  },
  {
    id: 'grab',
    title: '3 · Space — grab the focused item',
    note: 'Space on the focused item grabs it (fires reorder-start). The grabbed item is marked data-reorder-grabbed; the order has not changed yet. The announcement tells the user how to move it.',
    items: TASKS,
    keys: ['Space'],
    expected: { order: order('spec', 'build', 'test', 'demo', 'ship'), focusIndex: 0, grabbedIndex: 0, grabbedFrom: 0 },
    expectedAnnounce: 'Grabbed Write the spec. Item 1 of 5. Use the arrow keys to move, Space to drop, Escape to cancel.',
  },
  {
    id: 'grab-move',
    title: '4 · Grab, then Arrow Down — move the grabbed item',
    note: 'While grabbed, ArrowDown moves the item itself (fires reorder-move) and focus follows it. Grab the first item and move it down twice: it lands at index 2, the order changes, the others shift up.',
    items: TASKS,
    keys: ['Space', 'ArrowDown', 'ArrowDown'],
    expected: { order: order('build', 'test', 'spec', 'demo', 'ship'), focusIndex: 2, grabbedIndex: 2, grabbedFrom: 0 },
    expectedAnnounce: 'Write the spec, position 3 of 5.',
  },
  {
    id: 'grab-end',
    title: '5 · Grab, then End — send the grabbed item to the last position',
    note: 'While grabbed, End sends the item straight to the last position (fires reorder-move). Grab the first item, End: it becomes last and the rest shift up by one.',
    items: TASKS,
    keys: ['Space', 'End'],
    expected: { order: order('build', 'test', 'demo', 'ship', 'spec'), focusIndex: 4, grabbedIndex: 4, grabbedFrom: 0 },
    expectedAnnounce: 'Write the spec, position 5 of 5.',
  },
  {
    id: 'commit',
    title: '6 · Grab, move, drop — commit the new order (headline)',
    note: 'The headline keyboard reorder: focus the third item, grab it, move it up twice to the top, and drop. Drop fires the cancelable reorder-commit carrying the new order; the grab is released (nothing grabbed after).',
    items: TASKS,
    keys: ['ArrowDown', 'ArrowDown', 'Space', 'ArrowUp', 'ArrowUp', 'Enter'],
    expected: { order: order('test', 'spec', 'build', 'demo', 'ship'), focusIndex: 0, grabbedIndex: -1, grabbedFrom: -1 },
    expectedAnnounce: 'Add the conformance test moved to position 1 of 5.',
  },
  {
    id: 'cancel',
    title: '7 · Grab, move, Escape — cancel reverts the order',
    note: 'Escape while grabbed cancels: the item returns to where the grab began and the order is unchanged from before the grab (fires reorder-cancel). Grab the first item, move it down, Escape — back to the original order, focus restored to index 0.',
    items: TASKS,
    keys: ['Space', 'ArrowDown', 'ArrowDown', 'Escape'],
    expected: { order: order('spec', 'build', 'test', 'demo', 'ship'), focusIndex: 0, grabbedIndex: -1, grabbedFrom: -1 },
    expectedAnnounce: 'Reorder cancelled. Write the spec back at position 1 of 5.',
  },
  {
    id: 'edge-clamp',
    title: '8 · Edge clamp — movement stops at the boundary',
    note: 'Movement clamps at the ends (no wrap), both for roving focus and for a grabbed item. At the top, ArrowUp on the focus stays put; grab and ArrowUp again still stays at index 0 (a no-op move raises no event).',
    items: TASKS,
    keys: ['ArrowUp', 'Space', 'ArrowUp'],
    expected: { order: order('spec', 'build', 'test', 'demo', 'ship'), focusIndex: 0, grabbedIndex: 0, grabbedFrom: 0 },
    expectedAnnounce: 'Grabbed Write the spec. Item 1 of 5. Use the arrow keys to move, Space to drop, Escape to cancel.',
  },
];
