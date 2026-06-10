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
});
