// backlogGraph.js — the dependency relationship graph data for /backlog/ (#255).
//
// The ONE ordering primitive both the node sort and the edge sort use. Exported so it can be tested
// directly on both id shapes rather than only through whatever the live backlog happens to contain.
//
// `Number()` IS NaN ON A HASH ID. Under JIT numbering (#2288) an unlanded item's id is a hash (`xvatzyf`),
// not an `NNN`, so `Number(a) - Number(b)` yields NaN for any pair involving one — and a comparator that
// returns NaN is INCONSISTENT, leaving `Array.sort` free to permute the same data differently between runs.
// Numbered ids keep their numeric order and sort ahead of hash ids; hash ids compare lexicographically.
// Total, and stable for equal ids (which cannot occur here — ids are unique).
function compareIds(a, b) {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum !== bNum) return aNum ? -1 : 1;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

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

  // ORDER MUST NOT DEPEND ON `Number()`. Under JIT numbering (#2288) an unlanded item's `num` is a HASH
  // (`xvatzyf`), not an `NNN`, and `Number('xvatzyf')` is `NaN` — so `Number(a.num) - Number(b.num)` returns
  // `NaN` for any pair involving one. A comparator that returns `NaN` is INCONSISTENT, and `Array.sort` is
  // then free to produce a different permutation for the same data: the node order becomes
  // implementation-defined, which is exactly what the "a second build is byte-identical" invariant forbids.
  //
  // Every open hash-id item is already a node (the `isLiveStatus` half of the filter), so this was latent
  // from the moment JIT numbering shipped; it only became reachable when hash-id items started carrying
  // `blockedBy` edges to each other.
  //
  // Numbered items keep their numeric order and sort ahead of hash ids; hash ids fall back to a lexicographic
  // compare, which is total and stable. `num` is unique, so no pair ever compares equal.
  const byNumThenId = (a, b) => compareIds(a.num, b.num);

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
      batchable: !!it.batchable,        // Tier-A task or story ≤8 — the batch pool a points-budgeted batch packs
      // A human-only hold (deploy/credential/feedback/review/setup) that demotes the card out of Tier A — a
      // residual nothing in the backlog resolves. It belongs to the card, not a node, so the renderer draws it
      // as a marker on the gated node (not a separate node/edge). `what` feeds the hover tooltip.
      humanGate: it.humanGate ? { kind: it.humanGateKind || null, what: it.humanGate.what || '' } : null,
      direct: it.directUnblocks,        // #254 leverage fields
      chain: it.transitiveUnblocks,
      leverage: it.leverageScore,
      layer: layer(it.num),
      inEdge: inEdge.has(it.num),       // participates in ≥1 blockedBy edge (vs. a standalone open item)
    }))
    .sort(byNumThenId); // stable node order — see `byNumThenId`, which hash ids made load-bearing

  const edges = [];
  for (const it of items) {
    if (!inEdge.has(it.num)) continue;
    for (const b of it.blockers) {
      if (inEdge.has(b.num)) edges.push({ from: b.num, to: it.num }); // prerequisite → dependent
    }
  }
  // SAME total order as the nodes, for the same reason — `Number()` is NaN on a hash id, and an
  // inconsistent comparator makes edge order implementation-defined too. Fixing only the node sort
  // left this live in the same file (PR #1503 correctness juror, round 2).
  edges.sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to));

  return { nodes, edges, empty: nodes.length === 0, maxLayer: nodes.reduce((m, n) => Math.max(m, n.layer), 0) };
};

// Attached to the exported builder so a test can drive the ordering primitive DIRECTLY on both id
// shapes, instead of only through whatever ids the live backlog happens to contain that day.
module.exports.compareIds = compareIds;
