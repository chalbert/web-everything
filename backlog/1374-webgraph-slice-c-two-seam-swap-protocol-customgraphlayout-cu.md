---
kind: task
parent: "1351"
status: open
blockedBy: ["1372"]
dateOpened: "2026-06-21"
tags: []
---

# webgraph slice C — two-seam swap protocol (CustomGraphLayout + CustomGraphRenderer)

webgraph epic #1351 slice C: author the TWO protocol seams ratified in #1352 — CustomGraphLayout (GraphSpec to PositionedGraph coordinates, incl. optional edge waypoints) and CustomGraphRenderer (PositionedGraph + webtheme tokens to drawn output), co-authored around the shared PositionedGraph interface; native-first SVG + deterministic layered-DAG default. Files: we:src/_data/protocols/custom-graph-layout.json + we:src/_data/protocols/custom-graph-renderer.json + matching we:src/_data/plugs entries. Mirrors webcharts slice #573 (adapted to two seams). Blocked by slice A (#1372).
