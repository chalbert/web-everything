---
kind: decision
size: 3
parent: "099"
status: active
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
preparedDate: "2026-06-21"
relatedReport: reports/2026-06-21-viewport-transform-pan-zoom.md
tags: [decision, book-candidate, zoom, pan, viewport, gap, interaction]
---

# Zoom / pan a surface — viewport scale + translate standard: placement

**Prepared 2026-06-21.** No design exists yet — WE owns no zoom/pan concern today. The forks
below are grounded in a prior-art survey published as the
[viewport-transform-pan-zoom](/research/viewport-transform-pan-zoom/) `/research/` topic
(session report `we:reports/2026-06-21-viewport-transform-pan-zoom.md`), and each carries a
recommended default in **bold**. This is a **placement & shape** call — where the standard lives
and what form it takes — not a commitment to build; the realizing block is a deferred build.

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): scaling and
translating a content surface (image viewer, map, canvas, diagram, zoomable timeline) under pointer /
wheel / pinch / keyboard, with a viewport transform, bounds, and zoom-to-fit / zoom-to-point.

## The axis

The research decomposes the concern into a **transform-state model** sitting between two things WE
either has or is getting: the **raw input** (Pointer Events + wheel, with pinch recognition tracked by
[#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)) and the **render
primitive** (CSS `transform: scale()/translate()` — a GPU compositor transform, paint-only, no reflow,
animatable; **not** the newly-Baseline CSS `zoom`, which reflows layout and can't tween). The middle
model — a viewport transform `{ translate:[x,y], scale:k }` + `scaleExtent`/`translateExtent` **bounds**
+ a **focal** point (to-cursor / to-center / fit) + keyboard parity — is what no WE intent owns, and is
exactly d3-zoom's reusable abstraction (it "owns the vocabulary, not the apply").

No existing intent absorbs it: `interaction` owns input **modality** only
([we:src/_data/intents/interaction.json:7-13](../src/_data/intents/interaction.json#L7-L13)), not a
manipulation verb carrying a transform; `viewport-presence` owns in/out-of-view **observation**, the
mirror image — observe presence vs. transform the surface
([we:src/_data/intents/viewport-presence.json:5](../src/_data/intents/viewport-presence.json#L5));
`layout` owns shell/pane/dock **region structure** (its `pane` is a "resizable subdivision", but that's
divider mechanics, not content-surface transform —
[we:src/_data/intents/layout.json:24](../src/_data/intents/layout.json#L24)); `reorder` owns
user-mutable **collection order** ([we:src/_data/intents/reorder.json:5](../src/_data/intents/reorder.json#L5)).

### Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| **Fork 1** — placement & shape | **Own `viewport-transform` intent + a realizing `pan-zoom-surface` block** | Fold under `interaction` / dissolve into #1396 + CSS | High (med-high on the working name + whether the block ships now vs. as a deferred build) |

## Fork 1 — placement & shape: own intent (+ block), fold under `interaction`, or dissolve into #1396 + CSS?

*Fork-existence:* mutually-exclusive homes — only one can own the viewport transform-state, and options
(b)/(c) are each flawed for a stated reason, so this is a genuine either/or (one branch correct, the
others broken).

The crux is the reusable **middle model** (transform-state + bounds + focal + keyboard parity). d3-zoom,
panzoom, OpenSeadragon and the map libraries all ship JS precisely because that layer is non-trivial and
shared across image / map / canvas / diagram surfaces (full survey in the
[research topic](/research/viewport-transform-pan-zoom/)).

- **(a) Own `viewport-transform` intent (working name) + a realizing `pan-zoom-surface` block.** The
  intent owns `{translate, scale}` + `scaleExtent`/`translateExtent` bounds + the focal model, mirroring
  `viewport-presence`'s "owns the vocabulary, not the apply" charter; it **composes** `interaction`
  (modality) + #1396 (gesture recognition) and renders via CSS `transform`. A block ships the identical
  per-surface wiring (clamp / focal math / keyboard), which is why it earns a reusable block rather than
  a doc-only pattern (the #409 reasoning). **← recommended default.**
- **(b) Fold as a dimension / behavior under `interaction`.** *Rejected* — `interaction` owns input
  *modality* (pointer/touch/gamepad), not a manipulation verb carrying transform-state; widening it to
  absorb a foreign family dilutes the modality contract (the *decompose-overloaded-vocabulary* rule:
  never widen one intent to admit a foreign family).
- **(c) Dissolve into #1396 (gestures) + CSS transform — no new standard.** *Rejected* — #1396 recognizes
  the pinch/pan *gesture* and CSS `transform` *renders*, but neither homes the middle model (bounds,
  focal, keyboard parity). Every surface would re-implement clamp + focal + keyboard; the reusable
  vocabulary stays unhomed. This is the *compose-don't-duplicate* test in reverse — there **is**
  irreducibly-new vocabulary here, so it earns a home.

**Fork 1 sub-fork (defer to graduation, not a blocker):** the intent name (`viewport-transform` vs
`pan-zoom`) and whether the block ships now or is filed as a separately-prioritized build. Recommended:
ratify the *intent* now (working name `viewport-transform`), file the block as a deferred build —
realizing blocks are deferred builds, not part of the placement call.

---

## Context

### Supported by default (not decisions)

These are settled by the research + standing rules — ratify in passing, no fork:

- **Layer = intent, not Project/Protocol.** No provider seam, no interchange schema → `we:docs/agent/platform-decisions.md#project-protocol-bar`
  ("not every gap is a Project"); precedent [#409](/backlog/409-decision-master-detail-intent-vs-project/)
  (master-detail ruled standalone intent, not project) and [#022](/backlog/022-drag-and-drop-paradigms/)
  (drag → `reorder` intent + block).
- **Render substrate = CSS `transform: scale()/translate()`** (GPU compositor, paint-only, no reflow,
  animatable) — **not** CSS `zoom` (reflows layout, not animatable). SVG/canvas surfaces apply the same
  transform-state to `viewBox` / context.
- **Input composes `interaction` (modality) + #1396 (gesture recognition).** The intent owns the
  transform-state, never the gesture recognition (*compose-intent-don't-duplicate*). `touch-action: none`
  takes over native pinch on the surface.
- **Keyboard parity + zoom-to-fit / reset = a fixed mechanic, non-negotiable** — never a dimension
  (mirrors `reorder`'s keyboard-parity contract,
  [we:src/_data/intents/reorder.json:5](../src/_data/intents/reorder.json#L5), and the #1396 a11y
  baseline). Bounds (`scaleExtent`/`translateExtent`) and focal mode are dimensions with most-permissive
  defaults (unbounded zoom, focal = pointer).

### Proposed dimension sketch (for the realizing intent/block build, post-ratification)

| Dimension | Values | Default |
|---|---|---|
| `bounds` | `unbounded` / `clamped` (min/max scale + pan extent) | `unbounded` (most-permissive) |
| `focal` | `pointer` (zoom-to-cursor) / `center` / `fit` (zoom-to-content) | `pointer` |
| `input` | which axes are live: wheel · drag-pan · pinch · dblclick · keyboard | all on (keyboard non-optional) |
| *keyboard + reset* | **fixed mechanic** — `+`/`-`/`0` (reset) + arrow-pan, announced | non-negotiable |

### Relationship to the sibling decisions

- **#1396 pointer gestures** owns *recognizing* pinch/pan/swipe (the input vocabulary over Pointer
  Events). Pan/zoom composes it; pinch is the explicit overlap — #1396 recognizes the gesture, #1393
  maps it to a scale delta about a focal point.
- **#1384 spatial manipulation** (resize / snap / arrange) is a *different model* — discrete 2-D
  placement of *many* elements vs. continuous viewport transform of *one* surface. d3-zoom treats zoom
  as a behavior separate from drag-arrange. Bias toward separation: distinct siblings, the only shared
  piece is the #1396 pointer substrate (already factored out). Combine only if #1384's prep surfaces a
  unifying transform model — flag, don't merge.

### What this is NOT

- Not a commitment to build — placement / shape only; the realizing block is a deferred build.
- Not page-level / browser pinch-zoom (the `VisualViewport` API is whole-document, read-only) — this is
  an **element-scoped** surface transform.

### Definition of Ready (met)

- A `/research/` prep survey of the native substrate (Baseline-checked) + incumbents (d3-zoom, panzoom,
  OpenSeadragon, Leaflet/MapLibre) — published as [viewport-transform-pan-zoom](/research/viewport-transform-pan-zoom/),
  report linked via `relatedReport`.
- One genuine fork with named options + a bold default; the rest demoted to *Supported by default*.
