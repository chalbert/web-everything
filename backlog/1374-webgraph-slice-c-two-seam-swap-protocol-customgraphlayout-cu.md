---
kind: task
parent: "1351"
status: resolved
blockedBy: ["1372"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/protocols/custom-graph-layout.json
tags: []
---

# webgraph slice C — two-seam swap protocol (CustomGraphLayout + CustomGraphRenderer)

webgraph epic #1351 slice C: author the TWO protocol seams ratified in #1352 — CustomGraphLayout (GraphSpec to PositionedGraph coordinates, incl. optional edge waypoints) and CustomGraphRenderer (PositionedGraph + webtheme tokens to drawn output), co-authored around the shared PositionedGraph interface; native-first SVG + deterministic layered-DAG default. Files: we:src/_data/protocols/custom-graph-layout.json + we:src/_data/protocols/custom-graph-renderer.json + matching we:src/_data/plugs entries. Mirrors webcharts slice #573 (adapted to two seams). Blocked by slice A (#1372).

## Progress (batch-2026-06-20-1372-1369)

Done (mirrors webcharts slice #573, adapted to the #1352 two-seam split). Authored both seams:
- **Protocols:** `we:src/_data/protocols/custom-graph-layout.json` (GraphSpec → PositionedGraph; declares
  LayoutStrategy + determinism; deterministic layered-DAG default) + `we:custom-graph-renderer.json`
  (PositionedGraph + webtheme → output; SVG default; 3-axis conformance), both `ownedByProject: webgraph`.
- **Plugs:** `we:src/_data/plugs/customgraphlayout.json` + `we:customgraphrenderer.json` (base contracts).
- **Project page:** two protocol sections in `we:src/_includes/project-webgraph.njk` with the shared
  `PositionedGraph` / `CustomGraphLayout` / `CustomGraphRenderer` / `GraphHandle` interfaces (the seam the two
  protocols hand off across), anchored `protocol-custom-graph-layout` / `-renderer`.
- **Plug-description partials:** `we:src/_includes/plug-descriptions/customgraphlayout.njk` +
  `we:customgraphrenderer.njk` (Overview + Standards Alignment + Interface) — REQUIRED: `we:plug-pages.njk` includes
  the partial without `ignore missing`, so a new plug without one crashes the whole Eleventy build (caught
  here — `check:standards` is green but the live build froze until the partials landed).
- **Coverage terms:** `we:src/_data/semantics/customgraphlayout.json` + `we:customgraphrenderer.json` (so the
  #1371 protocol-coverage gate stays clean, consistent with CustomChartRenderer having a term).

Renders at `/projects/webgraph/#protocol-custom-graph-layout` + `#protocol-custom-graph-renderer`; both list
on `/protocols/`; `/plugs/customgraphlayout/` 200. Gate 0 errors; 38 protocols, 55 plugs, 284 terms, no dups.
