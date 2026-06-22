---
kind: story
size: 3
parent: "1254"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/platform-manager/platform-map.ts"
tags: []
---

# plateau-app Platform Map onto FUI graph/node-viz block

Migrate the Platform Map (plateau:src/platform-manager/platform-map.ts) off the hand-rolled viz onto the FUI graph/node-viz default impl. Ratchet release of #1254 now that the graph/node-viz gap #1289 shipped (we:graphs/contract.ts + fui:graphs/LayeredDagLayout.ts + fui:graphs/SvgGraphRenderer.ts). Read-only floor matches v1; gates on a rendered a11y/visual check per first-party-dogfood.

## Progress (batch-2026-06-22-1510-1483)

Migrated the Platform Map (`plateau:src/platform-manager/platform-map.ts`) off the hand-rolled column layout + inline-SVG render onto the FUI Web Graph default impl (#1289, the two-seam #1352 split):

- **`layeredDagLayout.layout(spec)`** (`@frontierui/graphs`, #1444) invents positions from a semantic `GraphSpec`; **`svgGraphRenderer.render(positioned, theme, target)`** (#1445) draws the `PositionedGraph`. Deleted the plateau-owned `layoutGraph`/`PlacedNode`/`PlacedEdge`/`renderNode`/`renderEdge` + the column-layout constants.
- The only plateau-owned half now is **`toGraphSpec`** — maps the #442 aggregated model (project/provider/protocol nodes; provides/consumes confirmed/potential edges) → the contract `GraphSpec` (`@webeverything/contracts/graph`). The `GraphSpec` is the only lock crossing the seam (statute #1290).
- **Test shifted to the plateau-owned mapping:** `plateau:src/platform-manager/platform-map.test.ts` now proves `toGraphSpec` (every node/edge mapped, potential labelled distinctly) + that it interoperates with `layeredDagLayout` (every node positioned, deterministic) — layout determinism itself is FUI's, conformance-tested there.
- **Aliases added** (`plateau:vite.config.mts` + `plateau:vitest.config.ts`): `@frontierui/graphs` (runtime) + `@webeverything/contracts/graph` (type-only) — mirrors the existing `@frontierui/blocks` / `@webeverything/contracts/*` pattern.

**Gate green:** plateau `npm test` 259/259. **Rendered check (Playwright on :4000 `/platform-map`, logged-in):** the FUI SVG renders with `role="graphics-document"` (WAI-ARIA) + a table fallback (a11y improvement over v1's `role="img"`), 16 graph elements, 0 app console errors. Read-only floor matches v1 (all nodes + placeable edges shown).
