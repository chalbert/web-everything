# Prep research — Zoom / pan a surface (viewport transform): placement & shape (#1393)

**Date:** 2026-06-21 · **Decision:** [#1393](/backlog/1393-zoom-pan-a-surface-viewport-scale-translate-standard-placeme/)
· **Parent:** [#099](/backlog/099-roadmap-to-mvp/) (evergreen-app north star, verb-axis lens)
· **Surfaced by:** verb-axis gap lens [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)

## The gap

Web Everything owns no concern for **scaling + translating a content surface** under
pointer / wheel / pinch / keyboard — the model behind an image viewer, a map, a canvas,
a diagram, a zoomable timeline. The verb-axis lens flagged "zoom / pan a surface" as a
vacant row: no intent owns it, and the closest pieces miss it —

- `we:src/_data/intents/interaction.json` owns input **modality** (pointer / touch /
  gamepad), not a manipulation verb carrying a transform.
- `we:src/_data/intents/viewport-presence.json` owns in/out-of-view **observation**
  (IntersectionObserver vocabulary) — the *mirror image*: observe whether the surface is
  visible vs. transform the surface itself.
- `we:src/_data/intents/layout.json` owns shell / pane / dock **region structure**, not
  content-surface transform.
- `we:src/_data/intents/reorder.json` owns user-mutable **collection order** (1-D list),
  a different model.

## Native substrate (checked, not asserted)

| Primitive | Status | Verdict for pan/zoom |
|---|---|---|
| `transform: scale()/translate()` + the individual `scale`/`translate` properties | Baseline; runs as a **GPU compositor transform**, paint-only, **no reflow**, animatable | **The render substrate.** Smooth zoom needs this — animating `scale` bypasses layout/paint. |
| CSS `zoom` property | **Newly Baseline** (Chrome 126 standardized the layout-affecting behavior; Firefox added it last) — scales **layout** (reflows surrounding flow) and is **not animatable** (snaps, no interpolation) | **Wrong primitive** for a pan/zoom viewport: it reflows and can't tween. Good for UI scaling, not surface transform. |
| Pointer Events + `wheel` | Baseline | The input source: wheel = zoom-to-point; drag = pan; two pointers = pinch (distance ratio → scale). |
| `touch-action: none` (CSS) | Baseline | Opt out of the browser's native pinch/pan on the surface so the app can take it over. |
| `VisualViewport` API | Baseline | **Page-level** pinch-zoom observation only — read-only, whole-document, not element-scoped. Not a substrate for an element surface. |
| Native **element-scoped** pan/zoom primitive | **None** | The library tell — every incumbent ships JS. |

So the platform gives the *render* primitive (`transform`) and the *raw input*
(Pointer/wheel) but **no first-class element pan/zoom** and **no native gesture
recognizer** (same gap [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)
pinch overlaps). The reusable middle — transform-state + bounds + focal model — is unhomed.

## Prior art — the incumbents (all JS, confirming the gap)

| Library | Model | What it proves |
|---|---|---|
| **d3-zoom** | A `zoom` **behavior** maintaining a transform `{x, y, k}` (translate x/y + scale k); `scaleExtent` (zoom bounds), `translateExtent` (pan bounds), a `constrain` fn keeping the viewport inside the translate extent; continuous update on wheel / drag / dblclick / touch; programmatic `zoomTo` / `zoomIdentity`. **Cleanly separates the transform STATE from how it's APPLIED** (CSS transform, SVG `viewBox`, or canvas) | **The canonical model.** Directly mirrors WE's `viewport-presence` charter ("owns the vocabulary, not the apply"). Gives the dimension vocabulary: bounds, focal point, input-axes, programmatic transitions. |
| **anvaka/panzoom**, **svg-pan-zoom**, **react-zoom-pan-pinch** | Generic transform-matrix pan+zoom over a DOM/SVG element; min/max scale; bounds; optional pinch | Confirms the same `{translate, scale}` + bounds shape is the reusable abstraction across content types. |
| **OpenSeadragon**, **Leaflet / MapLibre** | Tiled deep-zoom (image / map) with zoom *levels*, bounds, zoom-to-point | Specializations of the same model with tiled content; the transform-state contract is shared, the tiling is content-specific (a consumer concern, not the standard). |
| **Hammer.js / pinch-zoom-js** | Gesture recognizers feeding a transform | The *recognition* half — overlaps [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/); the standard should **compose** it, not re-implement it. |

**Convergent vocabulary** across all of them: a viewport **transform** = `{ translate:
[x,y], scale: k }`; **scaleExtent** (zoom bounds); **translateExtent** (pan bounds); a
**focal** point for zoom (to-cursor / to-center / fit-to-content); **input axes** (wheel,
drag, pinch, dblclick, keyboard); programmatic **transitions**. d3-zoom exists *because*
clamping + focal math + keyboard parity is non-trivial and reusable — that is the
irreducibly-new vocabulary WE would own.

## Classification (per-fork classification pass)

- **Which layer?** No provider seam, no interchange schema → **not a Project / Protocol**
  (`we:docs/agent/platform-decisions.md#project-protocol-bar`, precedent #409 master-detail "not every
  gap is a project"). It's an **intent** (the UX contract) + a realizing **block** (the
  wiring is identical per surface, so it earns a reusable block — #409 rejecting doc-only;
  #022 reorder → intent + block).
- **Protocol or intent dimension?** Intent — UX vocabulary only (transform-state, bounds,
  focal, input-axes), no impl refs (`we:docs/agent/platform-decisions.md#intents-ux-only`).
- **Expose the whole axis?** Bounds (scaleExtent / translateExtent) and focal mode are
  dimensions with most-permissive defaults (unbounded zoom, focal = pointer). Keyboard
  parity + zoom-to-fit/reset = **fixed mechanic**, non-negotiable (mirrors `reorder` /
  gesture a11y baseline) — never a dimension.
- **DI-injectable?** No — pure UX, no runtime registry.
- **Most-permissive default?** Unbounded zoom, pan unconstrained, focal = pointer.
- **Seam between intents?** Composes `interaction` (modality) + #1396 (gesture
  recognition); render via CSS `transform`. Distinct from #1384 spatial-manipulation
  (element placement of *many* items) — see below.

## Relationship to the sibling decisions

- **#1396 pointer gestures** — owns *recognizing* pinch / pan / swipe (the input
  vocabulary over Pointer Events). Pan/zoom **composes** it for input but owns the
  *transform-state* in the middle. Pinch is the explicit overlap: #1396 recognizes the
  gesture, #1393 maps it to a scale delta about a focal point.
- **#1384 spatial manipulation** (resize / snap / arrange) — a *different model*: discrete
  2-D **placement of multiple elements** on a grid, vs. continuous **viewport transform of
  one surface**. d3-zoom treats zoom as a behavior separate from drag-arrange. Bias toward
  separation (`we:docs/agent/platform-decisions.md`): distinct siblings, the only shared piece is the
  #1396 pointer substrate (already factored out). Combine only if #1384's prep surfaces a
  unifying transform model — flag, don't merge.

## Recommendation (carried into the prepared forks)

A **distinct standard earns a home** (the transform-state + bounds + focal + keyboard
model is irreducibly new) as **its own `viewport-transform` intent** (working name) +
a realizing `pan-zoom-surface` block, modeled on d3-zoom's `{translate, scale}` +
`scaleExtent`/`translateExtent`, mirroring `viewport-presence`'s observe-vocabulary
charter, composing `interaction` + #1396, rendered via CSS `transform: scale()`. Folding
under `interaction` (dilutes modality with a verb) and dissolving into #1396 + CSS
(leaves the middle model unhomed) are the rejected alternatives.

## Sources

- [zoom CSS property — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/zoom)
- [CSS zoom vs transform: scale() — modern-css.com](https://modern-css.com/scaling-elements-without-transform-hacks/)
- [scale() CSS function — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/scale)
- [d3-zoom — D3 by Observable](https://d3js.org/d3-zoom)
- [D3 zoom — the missing manual (datamake)](https://www.datamake.io/blog/d3-zoom/)
