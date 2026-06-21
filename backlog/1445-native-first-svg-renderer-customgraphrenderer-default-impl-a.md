---
kind: story
size: 5
parent: "1289"
locus: frontierui
status: active
blockedBy: ["1443"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: []
---

# native-first SVG renderer (CustomGraphRenderer default impl) + a11y adjacency floor

The native-first default CustomGraphRenderer behind the webgraph contract: PositionedGraph + ResolvedTheme -> SVG. Nodes as themed rects (fills resolve from theme tokens, never spec hex), edges as bezier paths; honours the semantic/presentation split so the same graph re-themes for free. Accessibility first-class: the tier-1 adjacency description-table floor mechanically derived from the graph (GraphHandle.describe()) + WAI-ARIA Graphics roles (graphics-document/graphics-object/graphics-symbol). Models fui:charts/SvgChartRenderer.ts:1-287. Consumes coordinates only (never GraphSpec), so swapping it leaves spec + layout untouched. Ships in fui:graphs/SvgGraphRenderer.ts (runtime -> FUI per #1290/constellation rule 1). locus: frontierui.

## Progress (batch-2026-06-21-1429-1487)

Built the default renderer in frontierui (modelling `fui:charts/SvgChartRenderer.ts`):
- **`fui:graphs/SvgGraphRenderer.ts`** (new) — `class SvgGraphRenderer implements CustomGraphRenderer`.
  `render(positioned, theme, target): GraphHandle` consumes **coordinates only** (never the `GraphSpec`).
  Nodes → themed `<rect>` + centred label (fill = `theme.palette[i % len]`, **never a spec hex** — same
  positioned graph re-themes for free); edges → cubic-bezier `<path>` between node centres (waypoint-aware).
  **A11y first-class:** SVG `role=graphics-document` (`aria-roledescription="graph"`), node/edge layers
  `graphics-object`, each node/edge `graphics-symbol` (labelled by id / "X to Y"); plus the **tier-1
  adjacency floor** — `describe()` returns mechanically-derived adjacency text ("N nodes, M edges. A → B,
  C. Isolated: …") and a `<figure>`-wrapped adjacency `<table>` data fallback. `GraphHandle` =
  `update`/`destroy`/`describe`.
- **`fui:graphs/index.ts`** — exported `SvgGraphRenderer` + `svgGraphRenderer` default instance.
- **`fui:graphs/__tests__/SvgGraphRenderer.test.ts`** (new) — 7 vectors: graphics-document role,
  per-node graphics-symbol, bezier edges, theme-palette fills (re-theme), tier-1 `describe()` floor,
  adjacency-table fallback, update/destroy. All green (uses the #1444 layout as the fixture, proving the
  two seams interoperate over `PositionedGraph`).

**A11y fix found in-build:** the `<th scope>` was set via the `.scope` IDL property which jsdom (and
older UAs) don't reliably reflect to the attribute — switched to `setAttribute('scope', …)` so the
adjacency table's row/col scoping is real. Gate green (0 errors), no tsc errors. Cytoscape/sigma/canvas
adapters register behind the same `CustomGraphRenderer` seam later, never the default.
