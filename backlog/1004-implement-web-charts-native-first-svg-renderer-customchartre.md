---
kind: epic
status: resolved
dateOpened: "2026-06-19"
dateResolved: "2026-06-20"
graduatedTo: none
relatedProject: webcharts
tags: [webcharts, build]
---

# Implement Web Charts — native-first SVG renderer + CustomChartRenderer registry runtime

Surfaced by #995. Verified epic #570 (slices #571–#574, all resolved) against the spec
(`we:src/_includes/project-webcharts.njk`): the slices delivered the **entire design surface** but **no
implementation**.

**Delivered (design — confirmed present):**
- Project node + skeleton spec page (#571) — `we:src/_includes/project-webcharts.njk`, `we:src/_data/projects.json`.
- Vega-Lite L1 `ChartSpec` profile schema (#572) — in `we:src/_data/semantics.json`.
- `custom-chart-renderer` protocol (#573) — `we:src/_data/protocols.json` (`ownedByProject: webcharts`).
- Conformance cases (#574) — four cases under `we:src/cases/webcharts/` (semantic-fidelity,
  theme-application, a11y-description-table, a11y-graphics-roles) — all three scored axes covered.

**Not delivered (impl — the gap this epic closes):** the protocol promises a *native-first SVG renderer
that ships as the default*, plus the renderer-swap registry runtime — neither exists (no chart renderer
under `plugs/`/`blocks/`; no capability-matrix entry). `status:concept` is therefore accurate.

Sliced 2026-06-20 (`we:reports/2026-06-20-backlog-split-analysis.md`) — sibling template #1018/#1048
(webpositioning: same CustomPositioner-family shape, contract→WE / runtime→FUI):
- **#1290 (decision)** — SVG renderer placement reconciliation (FUI vs `we:blocks/renderers/chart/`).
  De-buried from the old body NB below; blocks #1292.
- **#1291 (story·3)** — CustomChartRenderer registry runtime + contract → `@webeverything` (settled).
- **#1292 (story·5, blockedBy #1291,#1290)** — native-first SVG renderer (default impl).
- **#1293 (story·3, blockedBy #1292)** — conformance demo running `we:src/cases/webcharts/*` × 3 axes.

Deferred (could-not-split): **optional adapters** (Vega / Plotly / ECharts behind the one contract) —
three impls as one slice is another `size·8` lump; carve per-adapter once #1291 lands and real demand
exists.

Placement: registry/protocol contract → `@webeverything` (settled). The SVG renderer placement —
the protocol's "SVG renderer ships *with the standard*" wording reconciled against WE=contracts — is
**#1290**, not pre-decided here.
