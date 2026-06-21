---
kind: epic
status: open
dateOpened: "2026-06-20"
locus: webeverything
tags: [webgraph, viz, build]
---

# Scaffold the webgraph standard — project, GraphSpec profile, layout/renderer protocol, conformance cases

Umbrella for standing up a new **graph / node-link visualization** standard — a sibling of
[webcharts](/projects/webcharts/) in the viz family. Surfaced by the
[#1289](/backlog/1289-fui-graph-node-viz-block-gap-blocking-plateau-app-platform-m/)
FUI gap (the plateau-app Platform Map hand-rolls node/graph viz —
`plateau:src/platform-manager/platform-map.ts`); `/new-standard` ruled the gap needs a contract before any
FUI build slice, so this epic authors that contract. Contract → `@webeverything`, runtime → Frontier UI
(the settled viz-family rule).

**Shape settled by [#1352](/backlog/1352-webgraph-standard-shape-own-project-protocol-seam-count-a11y/)
(ratified 2026-06-21, codified `we:docs/agent/platform-decisions.md#viz-family-shape`)** — own `webgraph` project · **two**
protocol seams (`CustomGraphLayout` ⟂ `CustomGraphRenderer`) · adjacency description-table a11y floor (+
tier-2 research topic) · deterministic layered-DAG default (force-directed → adapter). The slices below now
build to that settled contract — ready to carve (`/slice 1351`).

## Planned deliverables (mirrors webcharts epic #570)

- **Project node + skeleton spec page** — `we:src/_data/projects/webgraph.json` + `we:src/_includes/project-webgraph.njk`.
- **`GraphSpec` semantic profile** — node/edge graph schema in `we:src/_data/semantics.json`, grounded on
  the existing `plateau:src/platform-manager/types.ts` `GraphNode`/`GraphEdge` shapes; presentation-free.
- **Layout / renderer protocol(s)** — `we:src/_data/protocols/` entry(ies) for the swap contract
  (`CustomGraphLayout` and/or `CustomGraphRenderer` per #1352 fork 2), native-first SVG + deterministic
  layered-DAG default.
- **Conformance cases** — `we:src/cases/webgraph/` scoring 3 axes (semantic fidelity · theme application ·
  accessibility), mirroring webcharts.
- **Research grounding** — add graph libraries (D3-force, ELK/dagre, Cytoscape, Mermaid, reaflow) to
  `we:src/_data/references.json`; a `/research/` topic for the graph-a11y model (#1352 fork 3).

## New terms (`we:src/_data/semantics.json`)

`graph-spec`, `node-link diagram`, `layout strategy`, `adjacency description`.

## Downstream

The contract this epic lands is the **foundational slice**
[#1289](/backlog/1289-fui-graph-node-viz-block-gap-blocking-plateau-app-platform-m/) is waiting on
(`unsplittableReason: foundational`) — once it ships, re-run `/split 1289` to carve the FUI build slices.
Adapters (force/ELK/Cytoscape behind the contract) are deferred and carved per-engine after the contract
lands, per the webcharts precedent.
</content>
