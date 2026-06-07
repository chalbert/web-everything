/**
 * Permanent conformance suite for the Reorderable List block (the playground's badges, in CI).
 *
 * Iterates the SHARED reorderable-list fixtures and, per case, (1) folds the key sequence through the
 * SAME reducer the demo uses and asserts it lands on the fixture's expected state and announcement,
 * then (2) renders the list at that state and runs the SAME audit the demo runs in the browser — so a
 * regression in the reference renderer, the roving-tabindex logic, the grab-then-move keyboard model,
 * or the announcer turns this red. Plus targeted assertions for each keyboard rule (rove, grab, move,
 * drop/commit, cancel/revert, edge clamp), the roving-tabindex invariant, and the moveBefore-backed
 * reconcile.
 *
 * See /blocks/reorderable-list/, the reorder intent (/intents/reorder/), and the Focus Delegation
 * intent (/intents/focus-delegation/).
 */
import { describe, it, expect } from 'vitest';
import { reorderableListCases } from '../../../renderers/reorderable-list/__fixtures__/reorderable-list-cases';
import {
  reduceReorder,
  renderReorderableList,
  auditReorderableList,
  reconcileOrder,
  announce,
  initialState,
  move,
  type ReorderItem,
  type ReorderState,
  type ReorderEvent,
} from '../../../renderers/reorderable-list/renderReorderableList';

const TASKS: ReorderItem[] = [
  { id: 'spec', label: 'Write the spec' },
  { id: 'build', label: 'Build the block' },
  { id: 'test', label: 'Add the conformance test' },
  { id: 'demo', label: 'Wire the playground' },
  { id: 'ship', label: 'Ship it' },
];

/** Fold a key sequence through the reducer from the initial state, tracking the last event raised. */
function walk(items: ReorderItem[], keys: string[]): { state: ReorderState; lastEvent: ReorderEvent | null } {
  let state = initialState(items);
  let lastEvent: ReorderEvent | null = null;
  for (const key of keys) {
    const r = reduceReorder(state, key);
    state = r.state;
    if (r.event) lastEvent = r.event;
  }
  return { state, lastEvent };
}

describe('Reorderable List reference — verified reorder contract (shared fixtures)', () => {
  for (const c of reorderableListCases) {
    it(`${c.title}: the key sequence lands on the expected state and the list audits clean`, () => {
      const { state, lastEvent } = walk(c.items, c.keys);
      expect(state, 'reducer landed elsewhere than the fixture expects').toEqual(c.expected);

      const got = lastEvent ? announce(lastEvent, c.items) : '';
      expect(got, 'announcement drifted from the fixture').toBe(c.expectedAnnounce);

      const root = renderReorderableList(c.items, {}, state);
      const result = auditReorderableList(root, c.items, state);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }
});

describe('Reorderable List structure & roving tabindex', () => {
  it('grounds in a native <ul reorderable role="listbox"> of role="option" items', () => {
    const root = renderReorderableList(TASKS);
    expect(root.tagName).toBe('UL');
    expect(root.hasAttribute('reorderable')).toBe(true);
    expect(root.getAttribute('role')).toBe('listbox');
    const lis = root.querySelectorAll(':scope > li');
    expect(lis.length).toBe(TASKS.length);
    expect(Array.from(lis).every((li) => li.getAttribute('role') === 'option')).toBe(true);
  });

  it('every item carries a stable data-reorder-id and preserve-on-move', () => {
    const root = renderReorderableList(TASKS);
    const lis = Array.from(root.querySelectorAll<HTMLElement>(':scope > li'));
    expect(lis.map((li) => li.getAttribute('data-reorder-id'))).toEqual(['spec', 'build', 'test', 'demo', 'ship']);
    expect(lis.every((li) => li.hasAttribute('preserve-on-move'))).toBe(true);
  });

  it('renders exactly one tabindex="0" item at the focused position; all others -1', () => {
    const state: ReorderState = { order: ['spec', 'build', 'test', 'demo', 'ship'], focusIndex: 2, grabbedIndex: -1, grabbedFrom: -1 };
    const root = renderReorderableList(TASKS, {}, state);
    const lis = Array.from(root.querySelectorAll<HTMLElement>(':scope > li'));
    const focusable = lis.filter((li) => li.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0].getAttribute('data-reorder-id')).toBe('test');
    expect(lis.filter((li) => li.getAttribute('tabindex') === '-1')).toHaveLength(lis.length - 1);
  });

  it('marks the grabbed item with data-reorder-grabbed (and no deprecated aria-grabbed)', () => {
    const state: ReorderState = { order: ['spec', 'build', 'test', 'demo', 'ship'], focusIndex: 1, grabbedIndex: 1, grabbedFrom: 1 };
    const root = renderReorderableList(TASKS, {}, state);
    const grabbed = root.querySelectorAll('[data-reorder-grabbed]');
    expect(grabbed).toHaveLength(1);
    expect(grabbed[0].getAttribute('data-reorder-id')).toBe('build');
    expect(root.querySelector('[aria-grabbed]')).toBeNull();
  });

  it('renders the scoped handle when grab="handle"', () => {
    const root = renderReorderableList(TASKS, { grab: 'handle' });
    expect(root.getAttribute('grab')).toBe('handle');
    expect(root.querySelectorAll('[data-reorder-handle]').length).toBe(TASKS.length);
  });

  it('applies an accessible name from the config', () => {
    const root = renderReorderableList(TASKS, { listLabel: 'Backlog order' });
    expect(root.getAttribute('aria-label')).toBe('Backlog order');
  });

  it('audit fails when the DOM order does not match the order model', () => {
    const state = initialState(TASKS);
    const root = renderReorderableList(TASKS, {}, state);
    // Swap the first two list items behind the audit's back.
    root.insertBefore(root.children[1], root.children[0]);
    const result = auditReorderableList(root, TASKS, state);
    expect(result.ok).toBe(false);
  });
});

describe('grab-then-move keyboard model (reduceReorder)', () => {
  const base = initialState(TASKS);

  it('moves roving focus with arrows when nothing is grabbed, clamping at the edges', () => {
    expect(reduceReorder(base, 'ArrowDown').state.focusIndex).toBe(1);
    expect(reduceReorder(base, 'ArrowUp').state.focusIndex).toBe(0); // clamp at top
    expect(reduceReorder({ ...base, focusIndex: 4 }, 'ArrowDown').state.focusIndex).toBe(4); // clamp at bottom
    expect(reduceReorder(base, 'End').state.focusIndex).toBe(4);
    expect(reduceReorder({ ...base, focusIndex: 3 }, 'Home').state.focusIndex).toBe(0);
  });

  it('roving focus raises no event and never changes the order', () => {
    const r = reduceReorder(base, 'ArrowDown');
    expect(r.event).toBeNull();
    expect(r.state.order).toEqual(base.order);
  });

  it('Space grabs the focused item and fires reorder-start', () => {
    const r = reduceReorder({ ...base, focusIndex: 2 }, 'Space');
    expect(r.state.grabbedIndex).toBe(2);
    expect(r.state.grabbedFrom).toBe(2);
    expect(r.event).toEqual({ type: 'reorder-start', itemId: 'test', fromIndex: 2 });
  });

  it('arrows move the grabbed item (not just focus) and fire reorder-move', () => {
    const grabbed = reduceReorder(base, 'Space').state; // grab index 0
    const r = reduceReorder(grabbed, 'ArrowDown');
    expect(r.state.order).toEqual(['build', 'spec', 'test', 'demo', 'ship']);
    expect(r.state.grabbedIndex).toBe(1);
    expect(r.state.focusIndex).toBe(1);
    expect(r.event).toEqual({ type: 'reorder-move', itemId: 'spec', fromIndex: 0, toIndex: 1 });
  });

  it('a clamped move while grabbed is a no-op (raises no event)', () => {
    const grabbed = reduceReorder(base, 'Space').state; // grab index 0
    const r = reduceReorder(grabbed, 'ArrowUp'); // already at the top
    expect(r.event).toBeNull();
    expect(r.state.order).toEqual(base.order);
  });

  it('Space/Enter while grabbed drops and fires the cancelable reorder-commit with the new order', () => {
    let s = reduceReorder(base, 'Space').state; // grab index 0
    s = reduceReorder(s, 'ArrowDown').state; // → index 1
    const r = reduceReorder(s, 'Enter'); // drop
    expect(r.state.grabbedIndex).toBe(-1);
    expect(r.event?.type).toBe('reorder-commit');
    expect(r.event?.order).toEqual(['build', 'spec', 'test', 'demo', 'ship']);
    expect(r.event).toMatchObject({ itemId: 'spec', fromIndex: 0, toIndex: 1 });
  });

  it('Escape while grabbed cancels — reverts to the pre-grab order and restores focus', () => {
    let s = reduceReorder(base, 'Space').state; // grab index 0
    s = reduceReorder(s, 'ArrowDown').state; // move down
    s = reduceReorder(s, 'ArrowDown').state; // move down again
    const r = reduceReorder(s, 'Escape');
    expect(r.state.order).toEqual(base.order); // back to the original order
    expect(r.state.grabbedIndex).toBe(-1);
    expect(r.state.focusIndex).toBe(0);
    expect(r.event).toEqual({ type: 'reorder-cancel', itemId: 'spec', fromIndex: 0 });
  });

  it('an unhandled key is a no-op', () => {
    const r = reduceReorder(base, 'a');
    expect(r.event).toBeNull();
    expect(r.state).toEqual(base);
  });

  it('move() relocates without mutating the source array', () => {
    const src = ['a', 'b', 'c'];
    expect(move(src, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(src).toEqual(['a', 'b', 'c']);
  });
});

describe('announce() — the live-region wording', () => {
  it('announces grab, move, commit (changed vs in-place), and cancel', () => {
    expect(announce({ type: 'reorder-start', itemId: 'spec', fromIndex: 0 }, TASKS))
      .toContain('Grabbed Write the spec. Item 1 of 5');
    expect(announce({ type: 'reorder-move', itemId: 'spec', fromIndex: 0, toIndex: 2 }, TASKS))
      .toBe('Write the spec, position 3 of 5.');
    expect(announce({ type: 'reorder-commit', itemId: 'spec', fromIndex: 0, toIndex: 2, order: [] }, TASKS))
      .toBe('Write the spec moved to position 3 of 5.');
    expect(announce({ type: 'reorder-commit', itemId: 'spec', fromIndex: 2, toIndex: 2, order: [] }, TASKS))
      .toBe('Write the spec dropped at position 3 of 5.');
    expect(announce({ type: 'reorder-cancel', itemId: 'spec', fromIndex: 0 }, TASKS))
      .toBe('Reorder cancelled. Write the spec back at position 1 of 5.');
  });
});

describe('reconcileOrder() — in-place relocation + roving refresh', () => {
  it('relocates items to match the order model and moves the roving tabindex/grabbed marker', () => {
    const root = renderReorderableList(TASKS); // initial order, focus 0
    const next: ReorderState = { order: ['build', 'spec', 'test', 'demo', 'ship'], focusIndex: 1, grabbedIndex: 1, grabbedFrom: 0 };
    const focusable = reconcileOrder(root, next);

    const domOrder = Array.from(root.querySelectorAll<HTMLElement>(':scope > li')).map((li) => li.getAttribute('data-reorder-id'));
    expect(domOrder).toEqual(next.order);
    expect(focusable?.getAttribute('data-reorder-id')).toBe('spec');
    expect(focusable?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('[data-reorder-grabbed]')).toHaveLength(1);
    expect(root.querySelector('[data-reorder-grabbed]')?.getAttribute('data-reorder-id')).toBe('spec');

    // The reconciled DOM audits clean against the state it was reconciled to.
    expect(auditReorderableList(root, TASKS, next).ok).toBe(true);
  });
});
