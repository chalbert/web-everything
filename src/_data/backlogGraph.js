// backlogGraph.js — the dependency relationship graph data for /backlog/ (#255).
//
// Builds a node/edge model of the backlog's `blockedBy` network from the loader (src/_data/backlog.js),
// reusing the reverse-edge + leverage derivations #254 already computed (no re-derivation here). Emitted
// as JSON in the page; src/assets/js/backlog-graph.js lays it out and draws an SVG (no chart library —
// the repo's native-first default). DETERMINISTIC — a pure function of the structured edge set, same
// input → same graph every build.
//
// A node is any item that participates in at least one `blockedBy` edge (degree > 0); the hundreds of
// edge-free items are omitted as noise. `layer` is the longest prerequisite-chain depth (roots with no
// blockers = 0), so the renderer can place prerequisites left of their dependents.
const loadBacklog = require('./backlog.js');

module.exports = () => {
  const items = loadBacklog();
  const byNum = new Map(items.map((it) => [it.num, it]));

  // Participants: any item that is a prerequisite OR has one — the connected dependency subgraph.
  const inEdge = new Set();
  for (const it of items) {
    if (it.blockers.length) {
      inEdge.add(it.num);
      for (const b of it.blockers) inEdge.add(b.num);
    }
  }

  // Longest prerequisite-chain depth, memoised + cycle-safe (validator forbids cycles; the guard just
  // stops a stray back-edge from looping). DAG ⇒ the memo is always complete.
  const layerCache = new Map();
  function layer(num, stack = new Set()) {
    if (layerCache.has(num)) return layerCache.get(num);
    if (stack.has(num)) return 0;
    stack.add(num);
    const it = byNum.get(num);
    let L = 0;
    for (const b of (it ? it.blockers : [])) L = Math.max(L, 1 + layer(b.num, stack));
    stack.delete(num);
    layerCache.set(num, L);
    return L;
  }

  // Nodes: every edge participant (the dependency network) PLUS every open/active item even if it has
  // no edges — so the "Open & blockers" view can show the *complete* open frontier, the connected
  // chains alongside the standalone ready items, not only the tangled ones (#257 follow-up). The
  // `inEdge` flag lets the renderer keep the "All" view edge-only (dependency history) while the live
  // view adds the edge-free open items as a grid. Edge-free items get layer 0 and zero leverage.
  const isLiveStatus = (it) => it.status === 'open' || it.status === 'active';
  const nodes = items
    .filter((it) => inEdge.has(it.num) || isLiveStatus(it))
    .map((it) => ({
      num: it.num,
      id: it.id,
      title: it.title,
      type: it.type,
      status: it.status,
      tier: it.tier || null,           // only open items carry a tier (#249)
      batchable: !!it.batchable,       // small Tier-A (story ≤3 / task) — the batch skill's eligibility
      direct: it.directUnblocks,        // #254 leverage fields
      chain: it.transitiveUnblocks,
      leverage: it.leverageScore,
      layer: layer(it.num),
      inEdge: inEdge.has(it.num),       // participates in ≥1 blockedBy edge (vs. a standalone open item)
    }))
    .sort((a, b) => Number(a.num) - Number(b.num)); // stable node order

  const edges = [];
  for (const it of items) {
    if (!inEdge.has(it.num)) continue;
    for (const b of it.blockers) {
      if (inEdge.has(b.num)) edges.push({ from: b.num, to: it.num }); // prerequisite → dependent
    }
  }
  edges.sort((a, b) => Number(a.from) - Number(b.from) || Number(a.to) - Number(b.to));

  return { nodes, edges, empty: nodes.length === 0, maxLayer: nodes.reduce((m, n) => Math.max(m, n.layer), 0) };
};
