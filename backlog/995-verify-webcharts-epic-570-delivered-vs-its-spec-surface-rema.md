---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1004-implement-web-charts-native-first-svg-renderer-customchartre.md
tags: []
---

# Verify webcharts epic #570 delivered vs its spec; surface remaining build

webcharts epic #570 (+ slices #571-574) is marked resolved, but the standard has zero plug/block implementation. Verify whether the resolved slices actually covered the spec surface (we:src/_includes/project-webcharts.njk: Vega-Lite L1 profile, CustomChartRenderer protocol, a11y conformance) or whether the epic resolved without delivering impl; surface the remaining build as items.

## Outcome (batch-2026-06-18)

Verified each resolved slice against the tree. **#570 delivered the full *design* surface but no
*impl* — the resolutions were correct, not premature.**
- #571 (project node + page) ✓ `we:src/_includes/project-webcharts.njk` + `we:src/_data/projects.json`.
- #572 (Vega-Lite L1 ChartSpec schema) ✓ in `we:src/_data/semantics.json`.
- #573 (CustomChartRenderer protocol) ✓ `custom-chart-renderer` in `we:src/_data/protocols.json`.
- #574 (conformance suite + a11y) ✓ `we:src/cases/webcharts/01-04` covering all three scored axes.

Gap = **implementation**: the protocol's promised native-first SVG renderer default + the renderer-swap
registry runtime do not exist (no chart renderer under `plugs/`/`blocks/`). `status:concept` is accurate.

Surfaced **#1004** (build epic) — CustomChartRenderer registry runtime + native-first SVG renderer (FUI)
+ optional Vega/Plotly/ECharts adapters + a conformance demo running the existing cases. No design item
needed (design is complete and ratified via #105).
