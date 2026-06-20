---
kind: story
size: 3
parent: "1004"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/plugs/customchartrenderregistry.json"
tags: []
---

# CustomChartRenderer registry runtime + contract

Mint the CustomChartRenderer registry runtime + contract: CustomChartRenderer / ResolvedTheme / ChartHandle types → @webeverything (ChartSpec from semantics), plus we:src/_data/plugs/customchartrenderer.json + we:src/_data/plugs/customchartrenderregistry.json plugs registration. Same impl-swap shape as we:src/_data/plugs/custompositioningregistry.json (#1048). Contract→WE settled by #1018/#1048 — no fork in this slice.

## Progress

Minted the two plug-registration JSON files mirroring the #1048 positioning pair
(same impl-swap shape): `we:src/_data/plugs/customchartrenderer.json` (the base
renderer contract — render(spec, resolvedTheme) → ChartHandle, satisfied by the
native-first SVG default and library adapters) and
`we:src/_data/plugs/customchartrenderregistry.json` (`window.customChartRenderers`,
L-tier declaration, injector-chain resolution). Status `concept`, project `webcharts`.
Contract→WE was settled by #1018/#1048 — no fork in this slice. The native-first SVG
default impl lives in FUI (#1292); conformance demo is #1293.
