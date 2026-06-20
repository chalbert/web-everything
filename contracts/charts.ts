// @webeverything/contracts/charts — the Web Charts protocol's pure-contract surface (#1004/#1290/#1334).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's
// (the native-first SVG renderer, every library adapter — Vega, Plotly, ECharts — and the
// `customChartRenderers` swap registry all live in `fui:charts/`, statute #1282/#1290). This is the
// FUI→WE arrow over which the standard resolves: any drawing engine satisfies `CustomChartRenderer` by
// consuming the semantic `ChartSpec` + `ResolvedTheme` without any runtime crossing the seam, exactly
// like `./positioning` and `./analytics`. #1292 (the FUI SVG renderer) imports these types.
export type * from '../charts/contract';
