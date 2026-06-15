---
type: issue
workItem: epic
status: resolved
dateOpened: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "project:webcharts"
tags: [charts, dataviz, webcharts, vega-lite, conformance, provider-registry, protocol, a11y, webtheme, native-first]
parent: "105"
---

# Scaffold the webcharts project — Vega-Lite L1 profile + CustomChartRenderer protocol + conformance suite (semantic/theme plane split + a11y axis)

Umbrella epic for building the webcharts standard ratified in #105 — sliced 2026-06-14 (see [reports/2026-06-14-backlog-split-analysis.md](../reports/2026-06-14-backlog-split-analysis.md), run 3) into 4 task children: **(a)** project node + skeleton page, **(b)** Vega-Lite L1 profile schema (semantic plane kept separate from the presentation/theme plane that consumes webtheme tokens; thin L1 core, L2+ tiers additive), **(c)** the CustomChartRenderer protocol (renderer-swap registry + native-first SVG default), **(d)** conformance suite scoring two axes (semantic fidelity, theme application) + a first-class a11y axis. DAG a → {b ∥ c} → d. Renderer adapters (Vega/Plotly/ECharts) and a thin chart-description intent are deferred follow-ons per #105.

**Graduated to** `project:webcharts` — slices a/b/c/d delivered: project node + page, Vega-Lite L1 profile schema, CustomChartRenderer protocol, conformance suite (semantic-fidelity + theme-application + first-class a11y axis).
