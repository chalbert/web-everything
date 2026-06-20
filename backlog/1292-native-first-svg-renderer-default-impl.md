---
kind: story
size: 5
parent: "1004"
locus: frontierui
status: resolved
blockedBy: ["1291", "1290", "1334"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:charts/SvgChartRenderer.ts"
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

## Progress (batch-2026-06-20b)

- Built `fui:charts/SvgChartRenderer.ts` — the native-first SVG `CustomChartRenderer` (tier `L1`),
  consuming a Vega-Lite L1 `ChartSpec` + `ResolvedTheme` and drawing SVG. Covers all five L1 marks
  (`bar`/`line`/`point`/`area`/`arc`) with a band x-scale + linear y-scale; honours the semantic/theme
  split — `color` is semantic, fills resolve from `theme.palette` in token order (no spec hex), so the
  same spec re-themes for free.
- Accessibility as a first-class axis: every render emits WAI-ARIA **Graphics roles**
  (`graphics-document` on `<svg>`, `graphics-object` per series, `graphics-symbol` per datum, each
  `aria-label`'d from the encoding — degrading to img/group) **and** a mechanically-derived
  `<figure><table>` data fallback (encodings → columns, data → rows, `description` → caption/label) +
  `ChartHandle.describe()`.
- Imports the WE contract via `@webeverything/contracts/charts` (#1334) — added the tsconfig path + vite
  alias (`fui:tsconfig.json`, `fui:vite.config.mts`) mirroring the existing `guard`/`analytics` entries
  (the FUI→WE arrow, #872). `fui:charts/index.ts` barrels the renderer.
- Conformance: `fui:charts/__tests__/SvgChartRenderer.test.ts` (8 tests) drives the renderer with the
  four `we:src/cases/webcharts/*` case specs (transcribed verbatim) and asserts each scored axis —
  semantic fidelity (one mark/row, heights proportional, in order), theme application (palette order +
  re-theme), a11y description-table fallback, a11y Graphics roles + derived labels — plus all-marks +
  handle lifecycle. Registered `charts/**` in `fui:vitest.config.ts`. Full FUI suite green (2438).
