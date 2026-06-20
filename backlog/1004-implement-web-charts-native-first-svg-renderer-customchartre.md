---
kind: epic
status: open
dateOpened: "2026-06-19"
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

Anticipated slices:
- **CustomChartRenderer registry runtime** — the renderer-swap registry the protocol specifies (native
  default + pluggable adapters), same impl-swap shape as CustomPositioner.
- **Native-first SVG renderer (default impl, FUI).** Consumes a Vega-Lite L1 `ChartSpec` + resolved
  webtheme tokens → SVG; honours the semantic/theme plane split.
- **Optional adapters** — Vega / Plotly / ECharts behind the one contract.
- **Conformance demo** — run the existing `src/cases/webcharts/*` against the SVG default and score the
  three axes (semantic fidelity / theme application / a11y).

Placement: registry/protocol contract → `@webeverything`; the SVG renderer + adapters (runtime) → FUI
(per the native-first-default-is-still-impl rule). NB: the protocol's "SVG renderer ships *with the
standard*" wording may want a small placement reconciliation against WE=contracts when the registry
slice is carved — flag, don't pre-decide.
