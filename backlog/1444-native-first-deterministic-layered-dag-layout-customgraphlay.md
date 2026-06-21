---
kind: story
size: 5
parent: "1289"
locus: frontierui
status: resolved
blockedBy: ["1443"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:graphs/LayeredDagLayout.ts"
tags: []
---

# native-first deterministic layered-DAG layout (CustomGraphLayout default impl)

The native-first default CustomGraphLayout behind the webgraph contract: GraphSpec -> PositionedGraph (layer assignment by longest-path + within-layer ordering + coordinate assignment, cycle-safe). Deterministic (same spec in, same coordinates out) so it is conformance-assertable, declaring its LayoutStrategy family per the #1352 two-seam ruling. Models the existing plateau columnar layout (plateau:src/platform-manager/platform-map.ts:57-91) generalized to arbitrary DAGs. Pure function, unit-testable on a GraphSpec fixture. Ships in fui:graphs/LayeredDagLayout.ts (runtime -> FUI per #1290/constellation rule 1). Non-deterministic engines (force-directed) register as adapters later, never the default. locus: frontierui.

## Progress (batch-2026-06-21-1429-1487)

Built the default layout in frontierui (new `fui:graphs/` dir):
- **`fui:graphs/LayeredDagLayout.ts`** (new) — `class LayeredDagLayout implements CustomGraphLayout`
  (`strategy: 'layered'`, `deterministic: true`). `layout(spec): PositionedGraph` is a pure function:
  (1) **cycle-safe longest-path layer assignment** — back-edges found via a deterministic DFS
  (visit in original spec order) are excluded so a cyclic spec still lays out, then `layer =
  max(layer(pred)+1)` over the forward DAG; (2) **deterministic within-layer ordering** — barycenter
  sweep (mean placed-row of forward predecessors) with original-index tie-break; (3) **columnar
  coordinate assignment** — `x = MARGIN + layer*(NODE_W+COL_GAP)`, `y = MARGIN + row*(NODE_H+ROW_GAP)`,
  mirroring `plateau:src/platform-manager/platform-map.ts:57-91` generalized from fixed kind-columns to
  computed layers. Edges to unplaced nodes + self-loops dropped (plateau parity); `bounds` span every
  layer × the tallest column. Imports `@webeverything/contracts/graph` **types only** (compile-erased,
  no runtime crossing the seam — statute #1290).
- **`fui:graphs/index.ts`** (new) — barrel exporting `LayeredDagLayout` + the `layeredDagLayout` default
  instance.
- **`fui:graphs/__tests__/LayeredDagLayout.test.ts`** (new) — 8 vectors: strategy/deterministic flags,
  linear-chain layering, longest-path diamond, cycle-safety, drop-unknown-edge, repeated-run determinism,
  bounds, empty graph. All green.
- **`fui:vitest.config.ts`** — added `graphs/**/__tests__/**` to the test `include` (new dir).

Gate green (0 errors), no tsc errors. The `force` layout + ELK/dagre adapters register behind the same
`CustomGraphLayout` seam later, never as the default. Sibling #1445 (SVG renderer) consumes the
`PositionedGraph` this emits.
