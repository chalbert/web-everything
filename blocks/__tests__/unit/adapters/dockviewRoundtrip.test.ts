/**
 * dockview adapter conformance (backlog #1627) — proves the independent 2nd conforming impl required by the
 * `#project-protocol-bar` rule before the #1486 dockable Protocol can be minted. Asserts:
 *
 *   1. `dockview → WE core → dockview` is a **lossless round-trip** (identity), divergent bits and all.
 *   2. The intermediate WE core is the convergent partition tree (row/column/stack, panel id+title) — the
 *      contract's core fields carry NONE of dockview's divergent encoding.
 *   3. Divergent dockview encodings (contentComponent / params / activeGroup / popout groups / canvas size)
 *      survive ONLY because they ride the contract's open extension slot (`ext`), never the core.
 *   4. The adapter is a real generator, not just a replay: a hand-authored core layout with NO `ext` still
 *      emits a valid dockview layout via sensible defaults.
 */
import { describe, it, expect } from 'vitest';
import {
  fromDockview,
  toDockview,
  type SerializedDockview,
} from '../../../adapters/dockview/dockviewLayout';
import type { DockLayout, DockSplitNode, DockStackNode } from '../../../dockable/contract';

// A representative dockview `api.toJSON()` layout: a HORIZONTAL root split (→ row) whose second child is a
// nested VERTICAL branch (→ column, exercising depth-parity orientation alternation), with multi-tab and
// single-tab groups, panel content/params/constraints, and canvas-global state.
const dockviewLayout: SerializedDockview = {
  grid: {
    orientation: 'HORIZONTAL',
    width: 1000,
    height: 800,
    root: {
      type: 'branch',
      data: [
        { type: 'leaf', size: 300, data: { id: 'g1', views: ['p1', 'p2'], activeView: 'p2' } },
        {
          type: 'branch',
          size: 700,
          data: [
            { type: 'leaf', size: 500, data: { id: 'g2', views: ['p3'], activeView: 'p3' } },
            { type: 'leaf', size: 300, data: { id: 'g3', views: ['p4', 'p5'], activeView: 'p4' } },
          ],
        },
      ],
    },
  },
  panels: {
    p1: { id: 'p1', title: 'Explorer', contentComponent: 'tree', params: { root: '/' } },
    p2: { id: 'p2', title: 'Search', contentComponent: 'search' },
    p3: { id: 'p3', title: 'Editor', contentComponent: 'monaco', minimumWidth: 200 },
    p4: { id: 'p4', title: 'Terminal', contentComponent: 'xterm' },
    p5: { id: 'p5', title: 'Output', contentComponent: 'log' },
  },
  activeGroup: 'g2',
  floatingGroups: [],
  popoutGroups: [],
};

describe('dockview adapter — dockable core round-trip (#1627)', () => {
  it('round-trips a dockview layout losslessly through the WE core schema', () => {
    const restored = toDockview(fromDockview(dockviewLayout));
    expect(restored).toEqual(dockviewLayout);
  });

  it('maps the gridview onto the convergent core partition tree (orientation alternation included)', () => {
    const layout = fromDockview(dockviewLayout);
    const root = layout.root as DockSplitNode;
    expect(root.type).toBe('row'); // HORIZONTAL gridview → row split
    expect(layout.orientation).toBe('row');

    const [left, right] = root.children;
    expect(left.type).toBe('stack');
    expect((left as DockStackNode).id).toBe('g1');
    expect((left as DockStackNode).tabs.map((t) => t.id)).toEqual(['p1', 'p2']);
    expect((left as DockStackNode).tabs.map((t) => t.title)).toEqual(['Explorer', 'Search']);
    expect((left as DockStackNode).activeTab).toBe(1); // activeView 'p2' is index 1

    // depth parity: a branch one level below a HORIZONTAL root alternates to VERTICAL → column
    expect(right.type).toBe('column');
    const grandchildren = (right as DockSplitNode).children;
    expect(grandchildren.map((n) => n.type)).toEqual(['stack', 'stack']);
    // single-tab group whose activeView is the first view carries no explicit activeTab (0 is the default)
    expect((grandchildren[0] as DockStackNode).activeTab).toBeUndefined();
  });

  it('keeps the core free of divergent encoding — it rides the ext slot only', () => {
    const layout = fromDockview(dockviewLayout);
    const left = (layout.root as DockSplitNode).children[0] as DockStackNode;

    // core panels carry ONLY id + title; no contentComponent / params leaked into the convergent schema
    expect(Object.keys(left.tabs[0])).toEqual(['id', 'title']);

    // divergent per-panel residue is preserved opaquely on the stack's ext.dockview
    expect((left.ext as any).dockview.panels.p1).toEqual({ contentComponent: 'tree', params: { root: '/' } });
    // canvas-global residue rides the ROOT node's ext.dockviewRoot, distinct from any per-stack ext.dockview
    expect((layout.root.ext as any).dockviewRoot).toMatchObject({
      orientation: 'HORIZONTAL',
      width: 1000,
      height: 800,
      activeGroup: 'g2',
      popoutGroups: [],
    });
  });

  it('generates a valid dockview layout from a hand-authored core with no ext (real adapter, not replay)', () => {
    const handAuthored: DockLayout = {
      root: {
        type: 'row',
        children: [
          { type: 'stack', tabs: [{ id: 'a', title: 'A' }] },
          { type: 'stack', tabs: [{ id: 'b', title: 'B' }, { id: 'c', title: 'C' }] },
        ],
      },
    };
    const sd = toDockview(handAuthored);
    expect(sd.grid.orientation).toBe('HORIZONTAL'); // row → HORIZONTAL default
    expect(sd.grid.width).toBe(1280);
    expect(sd.grid.height).toBe(720);
    expect(Object.keys(sd.panels).sort()).toEqual(['a', 'b', 'c']);
    expect(sd.panels.a).toEqual({ id: 'a', title: 'A' });

    const root = sd.grid.root as Extract<typeof sd.grid.root, { type: 'branch' }>;
    expect(root.type).toBe('branch');
    const leaves = root.data as Extract<(typeof root.data)[number], { type: 'leaf' }>[];
    expect(leaves[0].data.id).toBe('group-1'); // generated group id when the core has none
    expect(leaves[1].data.activeView).toBe('b'); // defaults to the first view
  });
});
