---
kind: decision
parent: "1351"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#viz-family-shape"
preparedDate: "2026-06-20"
locus: webeverything
tags: [webgraph, viz, constellation-placement]
---

# webgraph standard shape — own project, protocol seam count, a11y model, default layout

Decide the shape of a new **graph / node-link visualization** standard before scaffolding it, so the
[#1351](/backlog/1351-scaffold-the-webgraph-standard-project-graphspec-profile-lay/) scaffold epic builds
to a settled contract. Surfaced by the [#1289](/backlog/1289-fui-graph-node-viz-block-gap-blocking-plateau-app-platform-m/)
FUI gap (the plateau-app Platform Map hand-rolls node/graph viz —
`plateau:src/platform-manager/platform-map.ts`) — `/new-standard` ruled this needs a contract before any
FUI build slice, and #1289 is the foundational slice waiting on it.

## Ruling — RATIFIED 2026-06-21

All four forks ratified (user "all ratified"), two confidences raised by at-claim grounding:

1. **Placement → own `webgraph` project** (~85%). Vega-Lite is cartesian/statistical and expresses neither
   node-link data nor a layout algorithm; graph's distinctive **layout axis** earns its own home.
2. **Protocol seam count → TWO seams**: `CustomGraphLayout` (GraphSpec → positioned coordinates, incl.
   optional edge routing/waypoints) ⟂ `CustomGraphRenderer` (positioned graph + webtheme tokens → drawn
   output) (~80%, raised from the prepared 65%). Grounding: the reference consumer already splits a pure
   `layoutGraph()` from its renderer, and the whole ecosystem (ELK/dagre/d3-force) treats layout as a
   swappable engine independent of the renderer; the webcharts single-seam precedent does not transfer
   (charts have no layout-algorithm axis). **Interface note for #1351:** layout output may carry edge
   waypoints; the renderer falls back to straight/curved edges when absent.
3. **Graph-a11y → adjacency description-table as the tier-1 floor** (mirrors webcharts
   `a11y-description-table`), with treegrid / ARIA graph-role traversal as tier-2 (~70%). Scaffold epic
   spins a `/research/` topic to ground tier-2 before it is specced (no settled platform pattern yet).
4. **Native-first default layout → deterministic layered / columnar DAG** (~90%, raised from 85%) — exactly
   `plateau:src/platform-manager/platform-map.ts` (pure, stable, conformance-assertable). Force-directed
   ships as an adapter behind `CustomGraphLayout`, never the default.

Settled items below (contract→WE / runtime→FUI, 3-axis conformance, `GraphSpec` on existing
`GraphNode`/`GraphEdge`, per-engine deferred adapters) stand. Graduates into the **#1351** scaffold epic,
which now builds to this settled contract.

---

**Prepared, PENDING RATIFICATION** *(superseded by the Ruling above)* — every fork carries options + a
**bold default** + confidence; this item resolved on an explicit ratify, not off these defaults.

## Grounding (research + overlap, 2026-06-20)

- **Net-new** — no graph/node/edge/diagram entry in any registry (intents/blocks/plugs/adapters/projects/
  capabilities).
- **Sibling template = webcharts** — `we:src/_data/projects/webcharts.json`, spec
  `we:src/_includes/project-webcharts.njk`, protocol `we:src/_data/protocols/custom-chart-renderer.json`,
  plugs `we:src/_data/plugs/customchartrenderer.json` + `we:src/_data/plugs/customchartrenderregistry.json`. The family
  shape: a **semantic profile** (Vega-Lite L1) separate from presentation + a **renderer-swap protocol**
  with a **native-first SVG default** + adapters behind one contract + **3-axis conformance** (semantic
  fidelity · theme · a11y). Same shape as webpositioning's `CustomPositioner`. Contract → WE, runtime → FUI.
- **Consumer data shape to reproduce** — `plateau:src/platform-manager/types.ts` already defines
  `GraphNode {id, kind, label}` / `GraphEdge {from, to, kind, confidence, seam}`, laid out by
  `plateau:src/platform-manager/platform-map.ts` as a **deterministic left-to-right column DAG**.
- **Benchmark gap** — `we:src/_data/references.json` records no graph libraries; the scaffold epic adds
  D3-force, ELK / dagre (layered DAG), Cytoscape, Mermaid, reaflow as part of research.

### Grounding verification (2026-06-21, at claim)
- **webcharts protocol confirmed single-seam** (`we:src/_data/protocols/custom-chart-renderer.json`) — but
  charts have **no layout-algorithm axis** (marks are positioned by scales derived from the spec encodings),
  so the single `CustomChartRenderer` precedent does **not** transfer to graph as evidence for one seam.
- **Reference consumer is already split at layout⟂render** — `plateau:src/platform-manager/platform-map.ts`
  factors a **pure `layoutGraph()`** (graph → coordinates; "same graph in, same coordinates out, so the layout
  is testable") **separately** from `renderNode`/`renderEdge`/SVG assembly (coordinates → drawn output). The
  real-world consumer already draws the Fork-2 seam. This **raises Fork 2's two-seam confidence to ~80%** and
  **Fork 4's deterministic-layout confidence to ~90%** (platform-map *is* that default, and proves it's
  pure/assertable). The whole graph-viz ecosystem (ELK/dagre/d3-force/cola are layout-only engines paired
  with any renderer) reinforces layout as the independently-swappable axis.

## Fork 1 — placement: own `webgraph` project vs a profile inside webcharts

**Default: a new sibling project `webgraph`.** *(confidence ~80%)* Vega-Lite (webcharts' semantic core) is
cartesian/statistical — it expresses neither node-link data nor a **layout algorithm**, which is
graph-viz's distinctive axis. Folding graphs into webcharts would distort that project's profile. Residual:
a deliberately tiny semantic core could ride as a webcharts sub-profile and dodge a new project — but the
layout dimension earns its own home.

## Fork 2 — protocol seam count: one `CustomGraphRenderer` vs split `CustomGraphLayout` ⟂ `CustomGraphRenderer`

**Default (lean, ~65% — the real tension): two seams** — `CustomGraphLayout` (algorithm → node/edge
coordinates) separate from `CustomGraphRenderer` (coordinates → drawn output). Layout (force / layered /
tree / radial) is the independently-swappable axis — e.g. ELK layered layout with an SVG renderer — so the
dimension-vs-fixed-mechanic rule argues for exposing it. Against: webcharts ships a single renderer
protocol; two protocols is more surface. **Alternative:** ship one combined `CustomGraphRenderer` (layout +
draw) and split later if a real swap-layout-keep-renderer demand appears. This is the fork most worth a
careful read.

## Fork 3 — graph-a11y model

**Default: adjacency-**description-table** as the tier-1 floor** (mirrors webcharts'
`a11y-description-table` conformance case), with richer treegrid / ARIA graph-role traversal as tier-2.
*(confidence ~70%)* Residual: graph a11y has no settled platform pattern — the scaffold epic should spin a
`/research/` topic to ground this before tier-2 is specced.

## Fork 4 — native-first default layout

**Default: deterministic layered / columnar DAG** *(confidence ~85%)* — exactly what `plateau:src/platform-manager/platform-map.ts`
already does: dependency-free, stable, assertable in conformance. Force-directed (non-deterministic, hard
to test) ships as an adapter behind the `CustomGraphLayout` contract, not as the default.

## Settled (bake, not forks)

- Contract → `@webeverything`, runtime (SVG default + registry) → Frontier UI — the settled viz-family
  rule (webcharts, webpositioning).
- 3-axis conformance mirroring webcharts (`we:src/cases/webgraph/`).
- `GraphSpec` profile grounded on the existing `GraphNode`/`GraphEdge`.
- Adapters (force/ELK/Cytoscape) deferred and carved **per-engine** once the contract lands (mirrors
  webcharts' deferred adapters).

## Cross-ref

The graph **renderer placement** (FUI vs a `we:blocks/renderers/graph/` home) should **follow the webcharts
renderer-placement ruling [#1290](/backlog/1290-svg-renderer-placement-reconciliation-fui-vs-we-blocks-rende/)**,
not re-litigate it here.
</content>
</invoke>
