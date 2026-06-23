---
kind: decision
parent: "1442"
status: open
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-23-1442-slice-wave-4.md
tags: [packaging, custom-elements, block-model, conversion, decision, frontierui]
---

# pan-zoom-surface packaging mechanism: persistent light-DOM (B) vs shadow (C, #1349-S2)

Decide the custom-element packaging mechanism for the pan-zoom-surface block under #1442, ratifying the
already-shipped FUI implementation against the codified packaging rule (block-standard §7, #1321/#1381). The
block ships as an imperative factory returning a persistent `PanZoomHandle` the consumer drives post-mount, so
the live question is which runtime DOM family `we-pan-zoom-surface` adopts: **(B) persistent light-DOM** or
**(C) shadow** (the #1349-S2 hostile-host-CSS opt-in). This is a ratify: isolation is settled by the #1349
`webisolation` contract (published at `/research/scoped-component-css-isolation/`) and §7 item 4, the per-block
selection by §7 item 7. The recommended default is **(B)**, grounded below in what the code actually does.

## Recommended path at a glance

| Block | Reactive surface? | Faces hostile/unknown host CSS? | §7 family | Recommended |
|---|---|---|---|---|
| pan-zoom-surface | yes — persistent `PanZoomHandle` (`setState`/`zoomBy`/`reset`, `apply` callback) driven post-mount | no — host is the consumer's own viewport region, and the surface must style/transform the consumer's own content children | **(B) persistent light-DOM** | **(B)** |

## Grounding — what the pan-zoom code actually does

Read against the real FUI tree (`fui:blocks/pan-zoom-surface/`):

- **It is imperative + reactive, not transient.** `createPanZoomSurface(viewport, content, options)` returns a
  long-lived handle whose methods set state post-mount — `setState(t)`, `zoomBy(factor, px, py)`, `reset()`,
  `getState()`, `destroy()` (fui:blocks/pan-zoom-surface/PanZoomSurface.ts:35 the `PanZoomHandle` interface;
  fui:blocks/pan-zoom-surface/PanZoomSurface.ts:138 the returned handle). The consumer also passes an `apply`
  *function* property to redirect the transform onto an SVG `viewBox` / canvas context
  (fui:blocks/pan-zoom-surface/PanZoomSurface.ts:32, :62). These are **object/function property writes on a
  persistent element ref** — exactly §7 item 7's "framework-bound / reactive → (B)" signature, and the same
  reason the grouped form-control (#1456) and coordinator blocks (#1457) landed on B. There is no native
  single element to self-erase into (it wires a `viewport`/`content` pair), so (A) transient is excluded on
  its face — the open fork is genuinely B vs C.
- **It owns and styles the consumer's own content children.** The block clips at the `viewport`, applies
  `transform: translate()/scale()` to the `content` layer, and styles descendants via the light-DOM class
  `.fui-pan-zoom > *` (fui:blocks/pan-zoom-surface/PanZoomSurface.ts:62, :159–163). The transformed content
  is the *consumer's* markup (a map, a diagram, an image canvas) — it is not internal chrome to hide. A shadow
  boundary would force that content through a `<slot>` and re-introduce the cross-boundary styling/measurement
  friction (`getBoundingClientRect`, `scrollWidth`) the current light-DOM code relies on
  (fui:blocks/pan-zoom-surface/PanZoomSurface.ts:56, :58).
- **It does not face hostile / unknown host CSS.** The host is the consumer's *own* viewport region in their
  *own* app — the block is instantiated by the app around content the app authored, not dropped into an
  unknown third-party page. The §7-item-4 in-leak isolation it needs (no app CSS leaking *in* to the surface)
  is already delivered by the #1349 `webisolation` contract for light-DOM families — shadow is not required
  for that, and would add the `ElementInternals` + `::part` tax (§7 item 3) for an immunity this consumer
  never needs.

Reference patterns confirmed in the tree: **B** = `WizardElement extends HTMLElement` with persistent
property setters and no shadow root (fui:blocks/wizard/WizardElement.ts:25, :39 `set graph(...)`); **C** =
`StoryCanvasElement` which `attachShadow({ mode: 'open' })` precisely because *isolation is its contract* —
it renders untrusted webcase `code` and must hide it behind a boundary
(fui:blocks/story-canvas/StoryCanvasElement.ts:49, :11). Pan-zoom is the wizard shape, not the story-canvas
shape.

## Fork 1 — runtime DOM family for `we-pan-zoom-surface`

**Fork-existence justification (real either/or):** B and C are mutually-exclusive runtime DOM shapes for one
element — a custom element either keeps its content in light DOM (B) or behind a shadow boundary (C); it
cannot be both for the same block. The composability probe doesn't dissolve it: shadow's immunity *requires*
the boundary, so you can't surface C as a facade over a light-DOM kernel. The excluded branch is **(C) shadow**,
because the trigger that would make C correct — the block facing hostile / unknown host CSS and needing
immunity (§7 item 7's C condition) — is **absent**: pan-zoom's host is the consumer's own canvas region, and
shadow would actively harm its core job (styling/transforming the consumer's own content children). (A)
transient is not on this fork at all: there is no native element to erase into and the surface is reactive.

Crux: pin to §7 item 7 — pick the family by what the *primary* consumer needs. The primary consumer holds a
`PanZoomHandle` and drives `setState`/`zoomBy`/`reset`/`apply` post-mount (reactive), and supplies the content
to be transformed (which the surface must reach and style).

- **(a) Persistent light-DOM (B).** Native semantics free; no `ElementInternals` tax; the persistent element
  keeps the handle the consumer binds to; content children stay in light DOM so the surface can transform and
  style them and measure their layout directly; in-leak isolation rides the #1349 `webisolation` contract (§7
  item 4), so the *no-conflict* guarantee is kept without a boundary; lowest lock-in (no `::part` theming
  contract to honor). Matches the shipped code with **zero behavioral change** — ratifies what exists.
- **(b) Shadow (C).** *Rejected.* Buys hostile-host-CSS immunity and internal-hiding the block does not need —
  its content is the consumer's own, meant to be styled by the consumer, not hidden. Costs: pays the
  `ElementInternals` tax (form participation can't cross the boundary — not load-bearing here, but a cost) and
  the `::part` theming tax (§7 item 3); forces consumer content through a `<slot>`, complicating the
  transform/measure path the block depends on; raises lock-in via a `::part` contract. Per §7 item 4 isolation
  is **not** shadow-exclusive, so C buys no isolation B lacks. A deployment may still *upgrade* to C by opting
  into #1349 S2 if it later faces a hostile host — but that is an opt-in on top of B, not the default. Correct
  only on the absent hostile-host trigger.

**Recommended default: (a) persistent light-DOM (B)** — it is what §7 item 7 selects for a reactive,
content-owning surface whose host is friendly, it carries no shadow tax, and it ratifies the shipped
implementation without a rewrite. C stays available as the S2 opt-in for a hostile-host deployment.

Skeptic: SURVIVES — the strongest case for C is "a pan-zoom surface is a generic, embeddable widget that may
land in an unknown host whose CSS could leak in and break the transform, so default to the boundary." It does
not land: (1) the leak it names is *in-leak*, which §7 item 4 + the #1349 `webisolation` contract already cover
for light DOM — naming in-leak immunity argues for `webisolation`, not for shadow, so it does not clear §7
item 4's "isolation is not shadow-exclusive" bar; (2) it ignores that the block's job is to style and transform
the *consumer's own* content, which a shadow boundary would slot away and degrade — so C is not merely unneeded
but actively worse for the primary use; (3) the genuine hostile-host case is already modeled as the #1349-S2
*opt-in upgrade* on top of B, so defaulting to C would pull a tax onto every friendly-host consumer to serve a
case that has its own escape hatch. No §7 principle is violated by B; the §7-item-7 bias toward light-DOM
holds. Default unchanged.
