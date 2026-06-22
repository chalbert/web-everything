---
kind: epic
locus: frontierui
relatedReport: reports/2026-06-21-1289-split-analysis.md
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-22"
graduatedTo: none
tags: [fui, gap, dogfood, plateau-app, webgraph, viz, build]
---

# graph/node-viz block — webgraph default impl + demo (epic)

Umbrella for shipping the **graph / node-link visualization** default impl that retires the
plateau-app Platform Map's hand-rolled viz (`plateau:src/platform-manager/platform-map.ts`, #1254
dogfood). The WE **webgraph contract** is settled and scaffolded (#1352 shape → #1351 project + two
protocol seams + conformance cases), so this epic builds the **default impl** behind it: the WE
contract **TS file** (missed by #1351 — protocol JSON landed, types didn't, like the webcharts
#1291→#1334 gap), the two native-first defaults the two-seam contract requires
(`CustomGraphLayout` layered-DAG ⟂ `CustomGraphRenderer` SVG), and a 3-axis conformance demo.
Mirrors the webcharts #1004 carve, +1 layout slice. Sliced 2026-06-21 — see
[we:reports/2026-06-21-1289-split-analysis.md](/reports/2026-06-21-1289-split-analysis.md).

## Slices

- **#1443 (A)** — webgraph contract TS (`GraphSpec`/`PositionedGraph`/`CustomGraphLayout`/`CustomGraphRenderer`/`ResolvedTheme`/`GraphHandle`) → `we:graphs/contract.ts` + `we:contracts/graph.ts` (locus webeverything).
- **#1444 (B)** — native-first deterministic layered-DAG layout (`CustomGraphLayout` default) → `fui:graphs/LayeredDagLayout.ts` (blockedBy #1443).
- **#1445 (C)** — native-first SVG renderer (`CustomGraphRenderer` default) + a11y adjacency floor → `fui:graphs/SvgGraphRenderer.ts` (blockedBy #1443).
- **#1446 (D)** — webgraph conformance demo, 3 axes, end-to-end → `we:demos/webgraph-conformance-demo` (blockedBy #1444, #1445).

DAG: A → B, A → C, {B,C} → D. Adapters (D3-force/ELK/Cytoscape) and interaction (hover/zoom)
deferred — v1 matches the read-only plateau floor.

## Progress

- **2026-06-21:** split #1289 (story·13, blocked-by-design) → this epic + slices A–D (numbers filled
  by scaffold below). Contract now exists (#1351/#1352 resolved), so the epic is buildable.
