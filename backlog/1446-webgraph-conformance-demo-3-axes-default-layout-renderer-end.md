---
kind: story
size: 3
parent: "1289"
locus: webeverything
status: resolved
blockedBy: ["1444", "1445"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: demos/webgraph-conformance-demo.ts
tags: []
---

# webgraph conformance demo — 3 axes, default layout + renderer end-to-end

The webgraph conformance demo pairing the default layered-DAG layout (#1444) + SVG renderer (#1445) end-to-end, scoring the three ratified axes: semantic fidelity (every node/edge drawn), theme application (honours webtheme tokens, re-themes for free), accessibility (adjacency description-table floor + ARIA graphics roles). Mirrors the webcharts conformance demo (we:demos/webcharts-conformance-demo.ts, card #1293) and exercises the we:src/cases/webgraph/ cases in a real browser. Ships at we:demos/webgraph-conformance-demo. locus: webeverything.

## Progress

Landed (locus webeverything), mirroring the webcharts conformance demo:
- `we:demos/webgraph-conformance-demo.ts` — imports the type-only `we:graphs/contract.ts`; supplies an in-demo `DemoLayeredLayout` (deterministic longest-incoming-path layering, source-above-target) + `DemoSvgGraphRenderer`. The #1352 two-seam split hands COORDINATES only, so the renderer joins each `PositionedNode` back to the spec by id for the semantic plane (kind→palette, weight→stroke scale, label/kind→a11y). Transcribes the three `we:src/cases/webgraph/*` cases and scores 6 checks across the three axes.
- `we:demos/webgraph-conformance-demo.html` + `we:demos/webgraph-conformance-demo.css` (mirrored from the webcharts demo shell).
- `we:src/_data/demos/webgraph-conformance-demo.json` — the playground registry entry (project webgraph).
- Verified live on `:3000` via Playwright: **6/6 checks pass** (semantic-fidelity ×2, theme-application ×2, accessibility ×2), 3 gallery graphs render, no page errors. `check:standards` 0 errors.
