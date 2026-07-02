# Split analysis — #1289 FUI graph/node-viz block

**Date:** 2026-06-21
**Scope:** focused `/split 1289`
**Verdict:** **CAN split** → 1 epic + 4 slices (clean pipeline DAG). Mirrors the webcharts
`#1004` carve (contract-TS `#1334` + native SVG renderer `#1292` + conformance demo `#1293`),
**plus one extra layout slice** that the webgraph two-seam contract (`CustomGraphLayout` ⟂
`CustomGraphRenderer`, ratified `#1352`) mandates over the chart's single seam.

## Why it splits now (it didn't before)

`#1289` was `unsplittableReason: foundational`, `blockedBy: #1351` — there was no WE contract to
build against. **`#1351` (+ shape decision `#1352`) is now resolved**, landing:

- `we:src/_data/projects/webgraph.json` — the standard project node
- `we:src/_data/protocols/custom-graph-layout.json` + `we:src/_data/protocols/custom-graph-renderer.json` — the two seams
- `we:src/cases/webgraph/{01-semantic-fidelity,02-theme-application,03-a11y-adjacency-description}.html`
- GraphSpec semantic terms + a11y research topic

So the contract that gates the FUI build exists — `#1289` is unblocked and now investigable to
real file seams.

## Contract gap found during investigation (must be slice A)

`#1351`'s slices authored the protocol **JSON** + conformance **HTML** but **not a TypeScript
contract file** — there is no `GraphSpec` / `PositionedGraph` / `CustomGraphLayout` /
`CustomGraphRenderer` / `ResolvedTheme` / `GraphHandle` TS type anywhere in WE (verified: `grep`
across all `*.ts` returns zero). This is the **exact same gap** webcharts hit — `#1291` minted the
plug JSON, and the TS contract had to be authored separately by `#1334`
(`we:charts/contract.ts` + `we:contracts/charts.ts`, 135 lines, pure compile-erased types) before
the FUI renderer `#1292` could `import` it. The FUI graph layout **and** renderer impls both need
these types, so the contract TS is a shared prerequisite → **slice A**, locus `webeverything`.

(This is a missed-slice in `#1351`'s resolution, surfaced here rather than reopening the resolved
epic.)

## The carve

`#1289` converts in place `story(13)` → **storied epic** "graph/node-viz block (webgraph default
impl + demo)". Four child slices:

| Slice | Title | type/size | locus | blockedBy | graduatedTo target |
|---|---|---|---|---|---|
| **A** | webgraph contract TS file — `GraphSpec`, `PositionedGraph`, `LayoutStrategy`, `CustomGraphLayout`, `CustomGraphRenderer`, `ResolvedTheme`, `GraphHandle` (pure compile-erased types + `@webeverything/contracts/graph` re-export) | story · 3 | webeverything | — | `we:graphs/contract.ts` + `we:contracts/graph.ts` |
| **B** | native-first deterministic **layered-DAG layout** (`CustomGraphLayout` default impl): `GraphSpec → PositionedGraph` (layer assignment + ordering + coordinate assignment, cycle-safe; pure ⇒ conformance-assertable) | story · 5 | frontierui | A | `fui:graphs/LayeredDagLayout.ts` |
| **C** | native-first **SVG renderer** (`CustomGraphRenderer` default impl): `PositionedGraph + ResolvedTheme → SVG`; nodes as themed rects, edges as bezier paths; a11y first-class (adjacency description-table floor + WAI-ARIA Graphics roles, `GraphHandle.describe()`) | story · 5 | frontierui | A | `fui:graphs/SvgGraphRenderer.ts` |
| **D** | webgraph **conformance demo** (3 axes: semantic fidelity · theme application · accessibility), pairing default layout + renderer end-to-end | story · 3 | webeverything | B, C | `we:demos/webgraph-conformance-demo` |

**DAG:** `A → B`, `A → C`, `{B,C} → D`.
**Batchable:** **A now** (Tier-A once split); **B + C** after A resolves (then batchable together —
disjoint files); **D** after B+C. Total **16 pts** across 4 slices (vs the original 13 — the +3 is
the genuine extra layout seam the two-seam contract requires).

## Split-safety rubric — all five hold

1. **Independently deliverable** — A: types compile standalone (precedent #1334 shipped alone). B:
   pure function, unit-testable on a `GraphSpec` fixture (same shape as the plateau `layoutGraph`,
   `plateau:src/platform-manager/platform-map.ts:57-91`). C: unit-testable on a hand-built
   `PositionedGraph` + theme (doesn't need B at *test* time). D: end-to-end once B+C land. ✓
2. **No forced-together coupling** — disjoint files (`we:graphs/contract.ts` / `fui:graphs/LayeredDagLayout.ts` /
   `fui:graphs/SvgGraphRenderer.ts` / demo); the contract types are the only shared surface and they're the
   seam, not shared mutable state. B and C touch different files → batchable in parallel. ✓
3. **Agent-ready & bounded** — every target file is `file:line`-citable from the webcharts twin
   (`we:charts/contract.ts:1-135`, `fui:charts/SvgChartRenderer.ts:1-287`,
   `we:demos/webcharts-conformance-demo.ts`) and the plateau layout reference. No open design fork
   (shape settled by `#1352`; placement settled by `#1290`/constellation rule 1 — runtime → FUI). ✓
4. **Clean DAG, no cycles** — A is the single root; B,C fan out; D joins. ✓
5. **Net gain, not fragmentation** — splitting separates the WE contract (webeverything), two
   independently-swappable FUI default impls (the whole point of the two-seam contract), and the
   demo. Each is a coherent leaf with its own conformance story; bundling them would be one
   13-pt single-pass with no parallelism. ✓

## Could-not-split

None — all four conditions met; no design-gated or true-GAP rows remain (the only gate, the WE
contract, is captured as slice A rather than deferred).

## Notes

- FUI viz runtime convention is a **top-level dir** (`fui:charts/`, not under `blocks/`), so the
  graph impls go in **`fui:graphs/`** — mirror, not a block/custom-element (charts ship as a runtime
  library, no `<fui-chart>`; same for graph v1).
- Adapters (D3-force, ELK/dagre, Cytoscape behind the contracts) stay **deferred** — carved
  per-engine after the defaults land, per the webcharts precedent. Not part of this carve.
- Interaction model (hover/select/zoom) is **out of v1** — the plateau consumer
  (`plateau:src/platform-manager/platform-map.ts`) is read-only static SVG today; matching that floor is sufficient to retire the
  hand-rolled viz. A later slice can add interaction.
</content>
</invoke>
