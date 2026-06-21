---
kind: story
size: 3
parent: "1289"
locus: webeverything
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:graphs/contract.ts"
tags: []
---

# webgraph contract TS file (GraphSpec, CustomGraphLayout, CustomGraphRenderer types)

Author the pure-contract TypeScript half of the webgraph standard — the types #1351 missed (it landed the protocol JSON + HTML conformance cases but no TS, mirroring the webcharts #1291->#1334 gap). Defines GraphSpec (semantic nodes/edges), PositionedGraph (coordinates + edge waypoints + bounds), LayoutStrategy, CustomGraphLayout (spec->positioned), CustomGraphRenderer (positioned+theme->output), ResolvedTheme, GraphHandle (with describe() for the a11y adjacency floor). Compile-erased types only -> we:graphs/contract.ts + the @webeverything/contracts/graph re-export (we:contracts/graph.ts), exactly like we:charts/contract.ts + we:contracts/charts.ts. Both FUI default impls (#layout, #renderer) import these. locus: webeverything.

## Progress (batch-2026-06-21)

- Authored `we:graphs/contract.ts` — all types transcribed verbatim from the ratified spec
  (`we:src/_includes/project-webgraph.njk`): `GraphSpec` / `GraphNodeSpec` / `GraphEdgeSpec`,
  `LayoutStrategy`, `PositionedGraph` / `PositionedNode` / `PositionedEdge`, `CustomGraphLayout`,
  `CustomGraphRenderer`, `ResolvedTheme` (graph-local: `palette` + `edgeWeightRange`), `GraphHandle`.
  Compile-erased (type-only); `npx tsc --noEmit --strict` clean.
- Added the `@webeverything/contracts/graph` re-export (`we:contracts/graph.ts`, `export type *`) +
  the `./graph` subpath in `we:contracts/package.json` exports — mirrors charts/positioning.
- Wired resolution for the #1444/#1445 impl consumers: `fui:tsconfig.json` path +
  `fui:vite.config.mts` alias for `@webeverything/contracts/graph` (mirrors the charts entry; plateau
  doesn't consume this contract so no plateau alias). Keeps the FUI↔WE alias set in lockstep.
