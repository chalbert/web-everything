---
type: issue
workItem: epic
size: 13
status: open
dateOpened: "2026-06-14"
tags: [charts, dataviz, webcharts, vega-lite, conformance, provider-registry, protocol, a11y, webtheme, native-first]
parent: "105"
---

# Scaffold the webcharts project — Vega-Lite L1 profile + CustomChartRenderer protocol + conformance suite (semantic/theme plane split + a11y axis)

Build the webcharts standard ratified in #105: mint a webcharts project node (category standard, status concept) and author its artifacts — a Vega-Lite L1 profile schema (data/mark/encoding + scales/axes/legends), keeping the semantic plane separate from the presentation/theme plane that consumes webtheme tokens; a CustomChartRenderer protocol (renderer-swap registry + native-first SVG default); and a tiered conformance suite (webcases) scoring renderers on two axes — semantic fidelity and theme application — plus a first-class a11y axis (description channel, derived data-table, WAI-ARIA Graphics roles, required at L1). Adapters (Vega/Plotly/ECharts) and a thin chart-description intent are deferred. Slice before working.
