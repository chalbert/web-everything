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
   * NODE ORDER MUST BE TOTAL ACROSS BOTH ID SHAPES. Under JIT numbering (#2288) an unlanded item's `num` is a
   * HASH (`xvatzyf`), not an `NNN`, and `Number('xvatzyf')` is `NaN` — so the original
   * `Number(a.num) - Number(b.num)` comparator returned `NaN` for any pair involving one. A comparator that
   * returns `NaN` is INCONSISTENT and `Array.sort` may then permute the same data differently between runs,
   * which is the "byte-identical" invariant above failing intermittently rather than honestly.
   *
   * Asserted on the ORDER rather than on the comparator, so it holds however the sort is implemented:
   * numbered nodes ascend numerically and all precede hash-id nodes, which ascend lexicographically.
   */
  it('orders numbered nodes before hash-id nodes, each totally (#2288 JIT numbering)', () => {
    const nums = graph.nodes.map((n: any) => String(n.num));
    const isNumeric = (v: string) => Number.isFinite(Number(v));
    const firstHash = nums.findIndex((v) => !isNumeric(v));
    if (firstHash === -1) return; // no unlanded items in the corpus right now — nothing to assert
    // every numbered node precedes every hash-id node
    expect(nums.slice(0, firstHash).every(isNumeric)).toBe(true);
    expect(nums.slice(firstHash).some(isNumeric)).toBe(false);
    // …and each run is itself sorted, so the order is total rather than merely grouped
    const numeric = nums.slice(0, firstHash).map(Number);
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
    const hashes = nums.slice(firstHash);
    expect(hashes).toEqual([...hashes].sort());
  });
});
