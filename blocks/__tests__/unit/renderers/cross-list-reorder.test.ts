/**
 * Permanent conformance suite for the Reorderable List block's Tier-2 cross-list scope
 * (`withCrossListReorder`, reorder.scope.cross-list) — the playground's cross-list badges, in CI.
 *
 * Iterates the SHARED cross-list fixtures and, per case, (1) folds the key sequence through the SAME
 * reducer the demo uses and asserts it lands on the fixture's expected state and announcement, then
 * (2) renders the group at that state and runs the SAME audit the demo runs in the browser — so a
 * regression in the reference renderer, the group-wide roving-tabindex logic, the cross-list move /
 * cancel / commit model, or the announcer turns this red. Plus targeted assertions for each cross-list
 * rule (cross focus, cross move, in-list-after-cross via the delegated inner loop, commit snapshot,
 * cancel-reverts-across-lists, group-edge clamp) and the reconcile across lists.
 *
 * See /blocks/reorderable-list/, the reorder intent (/intents/reorder/), and the within-list suite in
 * reorderable-list.test.ts (the Tier-1 build this composes on, backlog #130).
 */
import { describe, it, expect } from 'vitest';
import { crossListReorderCases } from '../../../renderers/reorderable-list/__fixtures__/cross-list-reorder-cases';
import {
  crossListReorderGoldens,
  buildGoldens,
  goldenFor,
  goldenToRoot,
} from '../../../renderers/reorderable-list/__fixtures__/cross-list-reorder-goldens';
import {
  reduceCrossListReorder,
  relocate,
  renderCrossListReorder,
  reconcileCrossList,
  auditCrossListReorder,
  announceCrossList,
  initialCrossListState,
  type CrossListConfig,
  type CrossListEvent,
  type CrossListState,
  type ReorderItem,
  type ReorderList,
} from '../../../renderers/reorderable-list/renderCrossListReorder';

const ITEMS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'ship', label: 'Ship it' },
];
const CONFIG: CrossListConfig = { group: 'board' };
const lists = (): ReorderList[] => [
  { id: 'todo', label: 'Todo', order: ['spec', 'build'] },
  { id: 'doing', label: 'Doing', order: ['test'] },
  { id: 'done', label: 'Done', order: ['ship'] },
];

/** Fold a key sequence through the cross-list reducer from the initial state, tracking the last event. */
function walk(initial: ReorderList[], keys: string[]): { state: CrossListState; lastEvent: CrossListEvent | null } {
  let state = initialCrossListState(initial);
  let lastEvent: CrossListEvent | null = null;
  for (const key of keys) {
    const r = reduceCrossListReorder(state, key);
    state = r.state;
    if (r.event) lastEvent = r.event;
  }
  return { state, lastEvent };
}

describe('Cross-list reorder conformance — auditCrossListReorder reads the stored golden as DATA (#1467/#899; #1776)', () => {
  // Cross-list (Tier-2) twin of the within-list golden suite: per ratified #1467/#899 the verifier
  // asserts the STORED golden output, not a live recompute. Each case re-materializes a group root FROM
  // its committed golden (`goldenToRoot`) and runs `auditCrossListReorder` over it — GREEN WITHOUT a
  // live `renderCrossListReorder` in the assertion path. The reducer + announcer stay exercised live
  // below (the impl half FUI owns); when the WE runtime is deleted (#1772) they drop with it while this
  // data-only golden conformance (+ the golden-schema suite) survives.
  for (const c of crossListReorderCases) {
    it(`${c.title}: the key sequence lands on the expected state and the golden audits clean`, () => {
      // Reducer + announcer conformance (the cross-list keyboard model — impl half, exercised live).
      const { state, lastEvent } = walk(c.lists, c.keys);
      expect(state, 'reducer landed elsewhere than the fixture expects').toEqual(c.expected);
      const got = lastEvent ? announceCrossList(lastEvent, state, c.items) : '';
      expect(got, 'announcement drifted from the fixture').toBe(c.expectedAnnounce);

      // Audit conformance — STORED-GOLDEN data-reader: rebuild the group from the committed golden and
      // audit THAT against the case's contract state. No live renderCrossListReorder here.
      const root = goldenToRoot(goldenFor(c.id));
      const result = auditCrossListReorder(root, c.items, c.expected, CONFIG);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it('every fixture case has a committed golden (the #899 vector corpus is complete)', () => {
    expect(crossListReorderGoldens.map((g) => g.id).sort()).toEqual(crossListReorderCases.map((c) => c.id).sort());
  });

  it('committed goldens do not drift — they equal a fresh capture from the reference renderer', () => {
    expect(crossListReorderGoldens).toEqual(buildGoldens());
  });
});

describe('Cross-list group structure & group-wide roving tabindex', () => {
  it('grounds in a data-reorder-group wrapper of sibling <ul scope="cross-list" reorder-group> lists', () => {
    const root = renderCrossListReorder(lists(), ITEMS, CONFIG);
    expect(root.getAttribute('data-reorder-group')).toBe('board');
    const uls = Array.from(root.querySelectorAll(':scope > ul'));
    expect(uls).toHaveLength(3);
    expect(uls.every((ul) => ul.getAttribute('role') === 'listbox' && ul.getAttribute('scope') === 'cross-list' && ul.getAttribute('reorder-group') === 'board')).toBe(true);
    expect(uls.map((ul) => ul.getAttribute('aria-label'))).toEqual(['Todo', 'Doing', 'Done']);
  });

  it('places exactly one tabindex="0" item across the whole group; all others -1', () => {
    const state = initialCrossListState(lists());
    const root = renderCrossListReorder(lists(), ITEMS, CONFIG, state);
    const all = Array.from(root.querySelectorAll<HTMLElement>('li[data-reorder-id]'));
    const focusable = all.filter((li) => li.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0].getAttribute('data-reorder-id')).toBe('spec');
    expect(all.filter((li) => li.getAttribute('tabindex') === '-1')).toHaveLength(all.length - 1);
  });

  it('audit fails when an item lands in the wrong list', () => {
    const state = initialCrossListState(lists());
    const root = renderCrossListReorder(lists(), ITEMS, CONFIG, state);
    // Move the first Todo item into the Doing list behind the audit's back.
    const doing = root.querySelector('[data-list-id="doing"]')!;
    doing.appendChild(root.querySelector('[data-reorder-id="spec"]')!);
    expect(auditCrossListReorder(root, ITEMS, state, CONFIG).ok).toBe(false);
  });
});

describe('cross-list grab-then-move keyboard model (reduceCrossListReorder)', () => {
  it('Arrow Right moves the roving focus to the next sibling list when nothing is grabbed', () => {
    const r = reduceCrossListReorder(initialCrossListState(lists()), 'ArrowRight');
    expect(r.state.activeList).toBe(1);
    expect(r.state.focusIndex).toBe(0);
    expect(r.event).toBeNull();
  });

  it('Arrow Left at the first list is a clamped no-op (returns the same state)', () => {
    const base = initialCrossListState(lists());
    const r = reduceCrossListReorder(base, 'ArrowLeft');
    expect(r.state).toBe(base);
    expect(r.event).toBeNull();
  });

  it('a grabbed item crosses into the sibling list and fires a crossed reorder-move', () => {
    let s = reduceCrossListReorder(initialCrossListState(lists()), 'Space').state; // grab spec in Todo
    const r = reduceCrossListReorder(s, 'ArrowRight');
    expect(r.state.lists.find((l) => l.id === 'todo')!.order).toEqual(['build']);
    expect(r.state.lists.find((l) => l.id === 'doing')!.order).toEqual(['spec', 'test']);
    expect(r.state.activeList).toBe(1);
    expect(r.event).toMatchObject({ type: 'reorder-move', itemId: 'spec', fromList: 0, toList: 1, toIndex: 0, crossed: true });
  });

  it('Arrow Down after a cross delegates to the within-list engine (uncrossed move)', () => {
    let s = reduceCrossListReorder(initialCrossListState(lists()), 'Space').state;
    s = reduceCrossListReorder(s, 'ArrowRight').state; // doing = [spec, test]
    const r = reduceCrossListReorder(s, 'ArrowDown'); // → [test, spec]
    expect(r.state.lists.find((l) => l.id === 'doing')!.order).toEqual(['test', 'spec']);
    expect(r.event).toMatchObject({ type: 'reorder-move', crossed: false, toList: 1, toIndex: 1 });
  });

  it('drop commits with a snapshot of every list order and crossed=true', () => {
    let s = reduceCrossListReorder(initialCrossListState(lists()), 'Space').state;
    s = reduceCrossListReorder(s, 'ArrowRight').state;
    const r = reduceCrossListReorder(s, 'Enter');
    expect(r.state.grabbedIndex).toBe(-1);
    expect(r.event?.type).toBe('reorder-commit');
    expect(r.event?.crossed).toBe(true);
    expect(r.event?.orders).toEqual({ todo: ['build'], doing: ['spec', 'test'], done: ['ship'] });
  });

  it('Escape reverts the item to the list AND index the grab began in', () => {
    let s = reduceCrossListReorder(initialCrossListState(lists()), 'Space').state; // grab spec in Todo idx 0
    s = reduceCrossListReorder(s, 'ArrowRight').state; // cross into Doing
    const r = reduceCrossListReorder(s, 'Escape');
    expect(r.state.lists.find((l) => l.id === 'todo')!.order).toEqual(['spec', 'build']);
    expect(r.state.lists.find((l) => l.id === 'doing')!.order).toEqual(['test']);
    expect(r.state.activeList).toBe(0);
    expect(r.state.grabbedIndex).toBe(-1);
    expect(r.event).toEqual({ type: 'reorder-cancel', itemId: 'spec', fromList: 0, fromIndex: 0 });
  });

  it('an unhandled key is a no-op', () => {
    const base = initialCrossListState(lists());
    const r = reduceCrossListReorder(base, 'a');
    expect(r.event).toBeNull();
    expect(r.state).toBe(base);
  });
});

describe('cross-list empty-list edges', () => {
  // Doing is empty; Done already holds the cards a prior move pushed across.
  const withEmpty = (): ReorderList[] => [
    { id: 'todo', label: 'Todo', order: ['spec', 'build'] },
    { id: 'doing', label: 'Doing', order: [] },
    { id: 'done', label: 'Done', order: ['test', 'ship'] },
  ];

  it('emptying a list leaves the source <ul> grounded but empty, and the group audits clean', () => {
    // Rove into Doing's only card, grab it, cross into Done and drop.
    const { state } = walk(lists(), ['ArrowRight', 'Space', 'ArrowRight', 'Enter']);
    expect(state.lists.find((l) => l.id === 'doing')!.order).toEqual([]);

    const root = renderCrossListReorder(state.lists, ITEMS, CONFIG, state);
    const doingUl = root.querySelector('[data-list-id="doing"]')!;
    expect(doingUl.tagName).toBe('UL'); // still grounded
    expect(doingUl.querySelectorAll('li')).toHaveLength(0); // …just empty
    expect(auditCrossListReorder(root, ITEMS, state, CONFIG).ok).toBe(true);
  });

  it('crossing a grabbed item into an empty list lands it at position 1', () => {
    let s = reduceCrossListReorder(initialCrossListState(withEmpty()), 'Space').state; // grab spec in Todo
    const r = reduceCrossListReorder(s, 'ArrowRight'); // cross into the empty Doing
    expect(r.state.lists.find((l) => l.id === 'doing')!.order).toEqual(['spec']);
    expect(r.event).toMatchObject({ type: 'reorder-move', toList: 1, toIndex: 0, crossed: true });
    expect(announceCrossList(r.event!, r.state, ITEMS)).toBe('Moved Write the spec to list Doing, position 1 of 1.');
  });

  it('relocate() clamps a drop index into a zero-length target (inserts at 0)', () => {
    const s = reduceCrossListReorder(initialCrossListState(withEmpty()), 'Space').state; // grab spec
    const r = relocate(s, 1, 5); // into the empty Doing, index well past the end
    expect(r.state.lists.find((l) => l.id === 'doing')!.order).toEqual(['spec']);
    expect(r.event).toMatchObject({ toList: 1, toIndex: 0, crossed: true });
  });

  it('roving focus ONTO an empty list moves the group tabstop to the empty list container (#154, Option A)', () => {
    const onEmpty = reduceCrossListReorder(initialCrossListState(withEmpty()), 'ArrowRight').state;
    expect(onEmpty.activeList).toBe(1); // Doing — the empty list
    expect(onEmpty.focusIndex).toBe(0); // clamped to 0
    const root = renderCrossListReorder(onEmpty.lists, ITEMS, CONFIG, onEmpty);
    // No item carries the tabstop while the active list is empty…
    expect(root.querySelectorAll('li[tabindex="0"]')).toHaveLength(0);
    // …it rides the empty active list's <ul role="listbox"> container, so Tab still lands in the widget.
    const doingUl = root.querySelector('[data-list-id="doing"]')!;
    expect(doingUl.getAttribute('tabindex')).toBe('0');
    expect(doingUl.querySelectorAll('li')).toHaveLength(0); // still grounded + empty
    // exactly one tabstop across the whole group (the container) — the group never loses its tabstop
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(auditCrossListReorder(root, ITEMS, onEmpty, CONFIG).ok).toBe(true);
  });

  it('reconcileCrossList moves the tabstop onto/off the empty list container in place (#154)', () => {
    const root = renderCrossListReorder(withEmpty(), ITEMS, CONFIG); // initial: Todo[0] focused
    // Rove onto the empty Doing list: the container takes the tabstop, reconcile returns it as focusable.
    const onEmpty = reduceCrossListReorder(initialCrossListState(withEmpty()), 'ArrowRight').state;
    const focusable = reconcileCrossList(root, onEmpty);
    const doingUl = root.querySelector('[data-list-id="doing"]')!;
    expect(focusable).toBe(doingUl);
    expect(doingUl.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(auditCrossListReorder(root, ITEMS, onEmpty, CONFIG).ok).toBe(true);
    // Rove back out onto Done: the container tabstop clears and an item carries it again.
    const offEmpty = reduceCrossListReorder(onEmpty, 'ArrowRight').state;
    const back = reconcileCrossList(root, offEmpty);
    expect(doingUl.getAttribute('tabindex')).toBeNull();
    expect(back?.getAttribute('data-reorder-id')).toBe('test');
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(auditCrossListReorder(root, ITEMS, offEmpty, CONFIG).ok).toBe(true);
  });

  it('roving OUT of an empty list onto a non-empty one restores the single group-wide tabstop', () => {
    const onEmpty = reduceCrossListReorder(initialCrossListState(withEmpty()), 'ArrowRight').state; // on empty Doing
    const r = reduceCrossListReorder(onEmpty, 'ArrowRight'); // rove on to Done
    expect(r.state.activeList).toBe(2);
    expect(r.state.focusIndex).toBe(0);
    const root = renderCrossListReorder(r.state.lists, ITEMS, CONFIG, r.state);
    expect(root.querySelectorAll('li[tabindex="0"]')).toHaveLength(1);
    expect(auditCrossListReorder(root, ITEMS, r.state, CONFIG).ok).toBe(true);
  });
});

describe('relocate() — the free-movement primitive shared by the pointer path', () => {
  it('moves a grabbed item to an arbitrary list and index', () => {
    const s = reduceCrossListReorder(initialCrossListState(lists()), 'Space').state; // grab spec
    const r = relocate(s, 2, 5); // into Done, index clamped to the end
    expect(r.state.lists.find((l) => l.id === 'done')!.order).toEqual(['ship', 'spec']);
    expect(r.event).toMatchObject({ toList: 2, toIndex: 1, crossed: true });
  });

  it('is a no-op when nothing is grabbed', () => {
    const base = initialCrossListState(lists());
    expect(relocate(base, 1, 0)).toEqual({ state: base, event: null });
  });
});

describe('announceCrossList() — the live-region wording', () => {
  const board = initialCrossListState(lists());
  it('names the target list for a cross-list move and commit, in-list wording otherwise', () => {
    expect(announceCrossList({ type: 'reorder-move', itemId: 'spec', fromList: 0, fromIndex: 0, toList: 1, toIndex: 1, crossed: true }, board, ITEMS))
      .toBe('Moved Write the spec to list Doing, position 2 of 1.');
    expect(announceCrossList({ type: 'reorder-move', itemId: 'spec', fromList: 0, fromIndex: 0, toList: 0, toIndex: 1, crossed: false }, board, ITEMS))
      .toBe('Write the spec, position 2 of 2.');
    expect(announceCrossList({ type: 'reorder-cancel', itemId: 'spec', fromList: 0, fromIndex: 0 }, board, ITEMS))
      .toBe('Reorder cancelled. Write the spec back in Todo at position 1.');
  });
});

describe('reconcileCrossList() — in-place relocation across lists + group roving refresh', () => {
  it('relocates an item into a sibling list and moves the group-wide tabindex', () => {
    const root = renderCrossListReorder(lists(), ITEMS, CONFIG); // initial: focus Todo[0]
    const next: CrossListState = { lists: [
      { id: 'todo', label: 'Todo', order: ['build'] },
      { id: 'doing', label: 'Doing', order: ['spec', 'test'] },
      { id: 'done', label: 'Done', order: ['ship'] },
    ], activeList: 1, focusIndex: 0, grabbedIndex: 0, grabbedFromList: 0, grabbedFromIndex: 0 };
    const focusable = reconcileCrossList(root, next);

    const doing = root.querySelector('[data-list-id="doing"]')!;
    expect(Array.from(doing.querySelectorAll('li')).map((li) => li.getAttribute('data-reorder-id'))).toEqual(['spec', 'test']);
    expect(focusable?.getAttribute('data-reorder-id')).toBe('spec');
    expect(focusable?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('[data-reorder-grabbed]')).toHaveLength(1);
    expect(auditCrossListReorder(root, ITEMS, next, CONFIG).ok).toBe(true);
  });
});
