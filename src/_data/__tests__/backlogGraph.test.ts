// Guards the dependency-graph model (#255) — NOT magic numbers (the backlog changes daily). Proves the
// node/edge model stays internally consistent and deterministic however the backlog grows.
// See src/_data/backlogGraph.js + backlog/255-*.md.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const buildGraph = require('../backlogGraph.js');
const loadBacklog = require('../backlog.js');

const graph = buildGraph();
const items = loadBacklog();
const nodeNums = new Set(graph.nodes.map((n: any) => n.num));
const byNum = new Map<string, any>(graph.nodes.map((n: any) => [n.num, n]));

describe('backlog dependency graph — model invariants', () => {
  it('every edge connects two real nodes, prerequisite → dependent', () => {
    for (const e of graph.edges) {
      expect(nodeNums.has(e.from)).toBe(true);
      expect(nodeNums.has(e.to)).toBe(true);
      expect(e.from).not.toBe(e.to); // no self-edge
    }
  });

  it('a node appears iff it participates in an edge OR is an open/active item (#257 frontier)', () => {
    // The model carries the connected dependency subgraph (edge participants, incl. resolved history)
    // PLUS every edge-free open/active item, so the live "Open & blockers" view can show the complete
    // open frontier (src/_data/backlogGraph.js — the `inEdge.has || isLiveStatus` node filter). The
    // `inEdge` flag distinguishes the two so the renderer keeps the "All" view edge-only.
    const expected = new Set<string>();
    for (const it of items) {
      if (it.blockers.length) {
        expected.add(it.num);
        for (const b of it.blockers) expected.add(b.num);
      }
    }
    for (const it of items) if (it.status === 'open' || it.status === 'active') expected.add(it.num);
    expect(new Set(graph.nodes.map((n: any) => n.num))).toEqual(expected);
    // and the `inEdge` flag is true exactly for the edge participants (the All-view subset)
    const edgeParticipants = new Set<string>();
    for (const it of items) if (it.blockers.length) { edgeParticipants.add(it.num); for (const b of it.blockers) edgeParticipants.add(b.num); }
    for (const n of graph.nodes) expect(n.inEdge).toBe(edgeParticipants.has(n.num));
  });

  it('layer is the longest prerequisite-chain depth: every dependent sits strictly right of its prereqs', () => {
    for (const e of graph.edges) {
      expect(byNum.get(e.to).layer).toBeGreaterThan(byNum.get(e.from).layer);
    }
    // roots (no prereq among the nodes) are layer 0
    const hasIncoming = new Set(graph.edges.map((e: any) => e.to));
    for (const n of graph.nodes) if (!hasIncoming.has(n.num)) expect(n.layer).toBe(0);
  });

  it('carries the #254 leverage fields through onto each node', () => {
    for (const n of graph.nodes) {
      const src = items.find((i: any) => i.num === n.num);
      expect(n.direct).toBe(src.directUnblocks);
      expect(n.chain).toBe(src.transitiveUnblocks);
      expect(n.leverage).toBe(src.leverageScore);
      expect(n.tier).toBe(src.tier || null); // only open items carry a tier (#249)
    }
  });

  it('is deterministic — a second build is byte-identical', () => {
    expect(JSON.stringify(buildGraph())).toEqual(JSON.stringify(graph));
  });

  /**
   * ORDER MUST BE TOTAL ACROSS BOTH ID SHAPES, and this is asserted on the PRIMITIVE rather than on the live
   * corpus — because a corpus-only assertion silently no-ops the day the backlog contains no hash ids, which
   * is exactly what the first version of this test did (PR #1503 correctness juror, round 2).
   *
   * Under JIT numbering (#2288) an unlanded item's id is a HASH (`xvatzyf`), not an `NNN`, and
   * `Number('xvatzyf')` is `NaN` — so a `Number(a) - Number(b)` comparator returns `NaN` for any pair
   * involving one. A comparator that returns `NaN` is INCONSISTENT and `Array.sort` may then permute the
   * same data differently between runs, which is the byte-identical invariant above failing intermittently
   * rather than honestly.
   */
  it('compareIds is a TOTAL order over numbered and hash ids, and never returns NaN', () => {
    const { compareIds } = buildGraph as unknown as { compareIds: (a: string, b: string) => number };
    // numbered ids sort numerically, not lexicographically ('4' before '10', which a string sort reverses)
    expect(compareIds('4', '10')).toBeLessThan(0);
    expect(compareIds('004', '010')).toBeLessThan(0);
    // every numbered id precedes every hash id, in both argument orders (antisymmetry)
    expect(compareIds('999', 'xabc')).toBeLessThan(0);
    expect(compareIds('xabc', '999')).toBeGreaterThan(0);
    // hash ids compare lexicographically among themselves
    expect(compareIds('xa', 'xb')).toBeLessThan(0);
    expect(compareIds('xb', 'xa')).toBeGreaterThan(0);
    expect(compareIds('xa', 'xa')).toBe(0);
    // THE LOAD-BEARING ONE: never NaN, for any mix — that is what makes the comparator consistent.
    for (const [a, b] of [['1', '2'], ['1', 'x'], ['x', '1'], ['x', 'y'], ['004', 'xvatzyf']]) {
      expect(Number.isFinite(compareIds(a, b))).toBe(true);
    }
    // Two ids that are numerically equal compare 0 — `'4'` and `'004'` are the same NNN, so this cannot
    // arise between two real items (`num` is unique) and stable sort keeps their input order either way.
    // Asserted rather than assumed, because it is the one input for which the order is not total.
    expect(compareIds('4', '004')).toBe(0);

    // sorting a mixed list of DISTINCT ids is therefore total
    const mixed = ['xb', '10', 'xa', '4', '002'];
    expect([...mixed].sort(compareIds)).toEqual(['002', '4', '10', 'xa', 'xb']);
  });

  /**
   * …and BOTH sorts use it — asserted on the comparators the sorts actually pass to `Array.sort`, driven
   * over SYNTHETIC rows that always contain hash ids.
   *
   * The previous version of this test re-sorted the live `graph.edges` with a comparator it built itself
   * and checked the order came back unchanged. That proves nothing: the hand-built comparator and the
   * broken `Number(a) - Number(b)` one agree on every pair of numbered ids, so on any day the backlog
   * holds no hash-id edges the assertion passes against a fully unfixed implementation — it no-ops
   * exactly when it is needed (PR #1503 correctness juror, round 3). Same class of hole as the round-2
   * finding, one level further out: round 2 was a guard that returned early, this was a guard that
   * compared a thing against itself.
   *
   * Driving the exported `compareNodes`/`compareEdges` makes the assertion corpus-independent: revert
   * either sort to `Number()` and these fail on their own fixtures, today and every day.
   */
  it('the node and edge sorts BOTH use that total order (asserted on synthetic rows, not the corpus)', () => {
    const { compareNodes, compareEdges } = buildGraph as unknown as {
      compareNodes: (a: any, b: any) => number;
      compareEdges: (a: any, b: any) => number;
    };

    // Nodes: numbered ids in numeric (not lexicographic) order, all of them ahead of the hash ids.
    const nodes = [{ num: 'xb' }, { num: '10' }, { num: 'xa' }, { num: '4' }, { num: '002' }];
    expect([...nodes].sort(compareNodes).map((n) => n.num)).toEqual(['002', '4', '10', 'xa', 'xb']);

    // Edges: ordered by `from`, ties broken by `to`, with hash ids on both ends of the mix.
    const edges = [
      { from: 'xa', to: '3' },
      { from: '10', to: 'xa' },
      { from: '4', to: 'xb' },
      { from: '4', to: '10' },
      { from: 'xa', to: 'xb' },
    ];
    expect([...edges].sort(compareEdges).map((e) => `${e.from}->${e.to}`)).toEqual([
      '4->10', '4->xb', '10->xa', 'xa->3', 'xa->xb',
    ]);

    // And these are the same functions the built graph was sorted with, so the fixtures above guard the
    // live order too — this last part is the cheap corroboration, the fixtures are the proof.
    expect(graph.nodes).toEqual([...graph.nodes].sort(compareNodes));
    expect(graph.edges).toEqual([...graph.edges].sort(compareEdges));
  });
});
