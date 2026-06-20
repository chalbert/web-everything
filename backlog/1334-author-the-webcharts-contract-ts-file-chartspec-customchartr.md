---
kind: story
size: 3
parent: "1004"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:charts/contract.ts"
tags: []
---

# Author the webcharts contract TS file (ChartSpec / CustomChartRenderer / ResolvedTheme / ChartHandle) → @webeverything

Author the webcharts **contract TS file** in WE — the pure type-only renderer-swap contract that
`#1292`'s SVG impl (and every adapter) imports. The interfaces are already fully specified in the spec
(`we:src/_includes/project-webcharts.njk:71` for `ChartSpec`, `:137-157` for `CustomChartRenderer` /
`ResolvedTheme` / `ChartHandle`) but were **never authored as importable TS** — `#1291` (resolved) only
minted the two plug-registration JSON files (`we:src/_data/plugs/customchartrenderer.json` +
`we:src/_data/plugs/customchartrenderregistry.json`), not the contract types its title promised. Mirror the `#1048` positioning precedent
(`we:positioning/contract.ts` — pure-contract half, compile-erased) at `we:charts/contract.ts` and expose
it as a type-only `@webeverything` subpath. Transcription of a ratified spec (no design fork). Unblocks
`#1292` (the FUI SVG renderer).

## Why this is a prerequisite, not part of #1292

The `#1290` ruling sends all renderer **runtime** to FUI (`fui:charts/`, statute `#1282`) but keeps the
**contract** in WE (`#1291`, settled by `#1018`/`#1048`). #1292 builds the FUI runtime and must import
the WE contract types — which don't exist yet. This item closes that gap (the contract half #1291 left
unfinished). Found during batch-2026-06-20 pre-flight of #1292.

## Progress

- Authored `we:charts/contract.ts` — the pure-contract half (compile-erased, zero runtime emit),
  transcribed verbatim from the ratified spec (`we:src/_includes/project-webcharts.njk:71-162`):
  `ChartSpec` / `Mark` / `DataSource` / `Encoding` / `PositionChannel` / `FieldChannel` /
  `MeasurementType` / `Scale` / `Axis` / `Legend` (semantic L1 profile) + the `CustomChartRenderer`
  protocol + `ResolvedTheme` + `ChartHandle`. Mirrors the `#1048` `we:positioning/contract.ts` precedent.
- Exposed it as the type-only `@webeverything/contracts/charts` subpath: added `we:contracts/charts.ts`
  (`export type * from '../charts/contract'`) + the `"./charts"` entry in `we:contracts/package.json`
  exports (FUI→WE arrow, #872/#874).
- `npx tsc --noEmit --strict` clean on both files. Unblocks `#1292`.
