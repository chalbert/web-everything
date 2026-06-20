---
kind: story
size: 5
parent: "1004"
locus: frontierui
status: open
blockedBy: ["1291", "1290", "1334"]
dateOpened: "2026-06-20"
tags: []
---

# Native-first SVG renderer (default impl)

Native-first SVG renderer (default impl): consumes a Vega-Lite L1 ChartSpec + resolved webtheme tokens → SVG; honours the semantic/theme plane split; emits the a11y description-table fallback (we:src/cases/webcharts/03) + WAI-ARIA Graphics roles (we:src/cases/webcharts/04). Placement (FUI vs we:blocks/renderers/chart/) per the #1290 decision.

## Locus + blocker correction (batch-2026-06-20 pre-flight)

- **Locus → frontierui.** `#1290` ruled (dispositive, statute `#1282`/constellation-placement rule 1)
  that the native-default SVG renderer is delivery **runtime** → it lives in **FUI** (`fui:charts/`),
  not `we:blocks/renderers/chart/`. The card's "FUI vs WE" placement axis is closed: FUI. Locus was
  unset (defaulted to webeverything) — corrected here.
- **New blocker `#1334`.** The renderer imports the WE chart contract types (`ChartSpec` /
  `CustomChartRenderer` / `ResolvedTheme` / `ChartHandle`), but `#1291` (resolved) only minted the plug
  JSON, never authored the contract TS file. `#1334` closes that gap; this impl is `blockedBy` it.
