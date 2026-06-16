---
type: issue
workItem: task
parent: "570"
status: resolved
blockedBy: ["572", "573"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# webcharts slice d — conformance suite + a11y axis

Slice d of #570 (webcharts scaffold). Author the conformance suite as self-contained cases under src/cases/webcharts/*.html (precedent: src/cases/resource-loader/, src/cases/for-each/), scoring renderers on two independent axes — semantic fidelity (correct data->encoding) and theme application (honors webtheme token set / animates per spec) — plus a first-class accessibility axis: the Vega-Lite description channel, a data-`<table>` fallback derived from the spec's own data+encodings, and WAI-ARIA Graphics roles (graphics-document/graphics-object/graphics-symbol) for SVG output, required at L1 with graceful degradation. Leaves a scoreable conformance suite; check:standards green. Blocked by #572 (schema) and #573 (protocol).
