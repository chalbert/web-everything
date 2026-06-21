---
kind: decision
parent: "099"
size: 5
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, spatial-manipulation, resize, snap, dashboard, layout, reorder-intent, gap]
---

# Decision — Spatial manipulation / arrangeable surfaces (resizable splitter, snap-to-grid, draggable dashboard): placement & decomposition

A coverage gap (research 2026-06-21): WE has **no standard for user-driven spatial
manipulation** — resizing panes by dragging a splitter, snapping elements to a grid /
alignment points, and arranging/dragging widgets on a dashboard. The adjacent pieces exist
but none covers "grab an edge and resize" or "drag widgets around a grid." This item decides
**whether this is one standard or several, where each lives, and how much composes existing
intents** — the question, not the answer. Like [#022](/backlog/022-drag-and-drop-paradigms/)
(one decision → `reorder` intent + `reorderable-list` block + traits), the expectation is a
fan-out, not a pre-minted set of intents. **Needs `/prepare` before a `/decision` turn.**

## The gap (what the 2026-06-21 sweep found)

| Capability | Status today | Closest existing piece |
|---|---|---|
| **Resize a pane (splitter)** | ❌ none | `breakpoint`/`FlexRow` use `ResizeObserver` only as a *container-query fallback* — not user-driven resize; `layout.pane` is named "resizable subdivision" but has no divider mechanic |
| **Snap-to-grid / alignment** | ❌ none | `Carousel` uses CSS `scroll-snap` for *paging* only — no snap-to-grid, no magnetic alignment |
| **Arrangeable / draggable dashboard** | ❌ none | `reorder` intent + `Reorderable List` block do list reorder; `layout` defines `shell`/`pane`/`dock` regions — neither does free 2-D widget arrangement |
| **Drag / reorder (adjacent — covered)** | ✅ `reorder` intent + `Reorderable List` block ([#022](/backlog/022-drag-and-drop-paradigms/)) | Pointer + keyboard parity + live-region announce; the likely substrate to *compose* |

Refs: [we:src/_data/intents/reorder.json](../src/_data/intents/reorder.json) (`draft`),
[we:src/_data/intents/layout.json](../src/_data/intents/layout.json) (`concept`, `shell`/`pane`/`dock`),
[we:src/_data/intents/breakpoint.json](../src/_data/intents/breakpoint.json) (`draft`),
[we:src/_data/blocks/reorderable-list.json](../src/_data/blocks/reorderable-list.json),
[we:src/_data/blocks/carousel.json](../src/_data/blocks/carousel.json),
[we:src/_data/blocks/flex-row.json](../src/_data/blocks/flex-row.json) ([#508](/backlog/508-flexrow-intrinsic-auto-flow-block-webblocks-realizes-breakpo/)).

## Web-platform grounding (verify during prep)

Spatial manipulation is one of the **least-covered areas by native CSS/HTML** — the incumbents
(react-grid-layout, gridstack, Muuri, the Split library, golden-layout) are all JS libraries because
the platform has no first-class splitter, dashboard-grid, or snap-to-grid primitive. What *does*
exist and should be the native-first substrate: Pointer Events + `Element.moveBefore()` (already
the `reorder` substrate), `ResizeObserver`, CSS `resize` (limited: textarea / `overflow` boxes only),
CSS Grid as the snap target, CSS `scroll-snap` (paging, not free placement), CSS Anchor Positioning
([webpositioning](../src/_data/projects.json)), and `aria` patterns for `separator` / windowsplitter +
`grid`. Confirm current Baseline status of each in prep — do not assert without checking.

## Open forks (the prep agenda — sketch, not ratified)

1. **One standard or several?** Is "spatial manipulation" one composable intent family, or distinct
   standards for *resize*, *snap*, and *arrange*? (Bias-toward-separation says split; the shared
   pointer / keyboard / commit / announce model — already in `reorder` — may argue one family with
   dimensions. The genuine call.)
2. **Placement per piece** — intent vs block vs trait vs new project. Precedent: master-detail
   ([#409](/backlog/409-decision-master-detail-intent-vs-project/)) and responsive-layout
   ([#467](/backlog/467-responsive-container-query-layout-placement-new-project-vs-i/))
   both ruled *intent, not project* ("not every gap is a project"). A `splitter` / `resizable`
   intent + a `snap` intent + a `dashboard` / `arrangeable-surface` block that **composes
   `reorder` + the two** is the shape to pressure-test.
3. **How much composes `reorder`?** A draggable dashboard is reorder generalized from 1-D list
   order to 2-D placement (+ resize + snap). Does `reorder` gain a `scope: grid-2d` /
   `placement` dimension, or is arrangement a separate intent that *uses* `reorder`'s drag
   mechanics? Avoid overloading `reorder` past its "user-mutable order of a collection" contract.
4. **Snap: own intent or a dimension?** Snap-to-grid / alignment-guides may be its own intent or a
   `snap` dimension shared by both resize and arrange (and a sibling of carousel's scroll-snap).
5. **Keyboard / a11y parity** — non-negotiable per the `reorder` contract; resize and arrange must
   carry the same keyboard + live-region baseline (`role=separator` with `aria-valuenow` for
   splitters, grid keyboard nav for arrange). Bake as a fixed mechanic, not a dimension.

## What this is NOT

- Not a commitment to build — placement / decomposition only; the realizing blocks are deferred builds.
- Not window-management / OS-style tiling (movable floating windows) — out of scope unless prep
  finds it's the same model; flag separately if so.

## Definition of Ready (for the eventual `/decision` turn)

- A `/research/` prep survey of the incumbents (react-grid-layout, gridstack, the Split library,
  golden-layout, Muuri) + the native-substrate Baseline check.
- Each fork above stated with options + a **bold** recommended default and a confidence level.
- `preparedDate` stamped. Run `/prepare 1384` to do this.
