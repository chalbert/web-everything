---
kind: decision
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1406"]
relatedReport: reports/2026-06-23-region-select-recognizer-shape-vocabulary.md
tags: [decision, parked, selection, marquee, spatial, residual, watch, validation-gate]
---

# Marquee recognizer-shape vocabulary — promote to a region-select intent?

## Digest

Recommended verdict: **NOT-YET** — hold the `region-select` intent (YAGNI), confidence ~85%. WE ships
exactly one recognizer shape (the rectangle AABB) and one realization (the `marquee-select` behavior
block). A single shape is a behavior, not a vocabulary; minting an intent now invents a `shape` dimension
with one member. Un-gate to **GO** the moment a *second* real recognizer shape recurs as demand
(free-form lasso, polygon, or center-point/nearest). A backlog sweep found no such second consumer today,
so NOT-YET holds.

## What you're deciding

Whether to promote the marquee recognizer from a single behavior block to a cross-cutting
**`region-select` intent** carrying a **`shape: rect | lasso | polygon | nearest`** dimension — with the
existing [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/)
`marquee-select` block as its *first realization* (the `rect` shape). Promotion would lift the
gesture/geometry layer (band geometry + hit-testing + modifier resolution) into the intent and name the
recognizer shape as a configurable dimension. It is a go / no-go on building that intent, plus the trigger
that flips the gate.

## Why this isn't a classic fork (and is still a decision)

There is **no excluded rival branch** to weigh — this is a one-sided *validation gate* (the third decision
archetype), not a merit fork. #1406 already ruled the *placement* (behavior block, with `scope: spatial`
on `selection` rejected); what remains is a single yes/no on whether a recognizer *vocabulary* eventually
earns its own intent home, and on what trigger. It is still a real decision: the human decides whether a
speculative generalization earns a place on the roadmap now or waits for evidence. (It is not a
coexistence question either — there's nothing to support-both; the intent either earns a home or it
doesn't yet.)

## Context & prior-art delta

[Prior-art survey](/research/region-select-recognizer-shape-vocabulary/). Incumbents converge on the
rectangle as the *first* recognizer shape and only grow a shape vocabulary as the tool matures:

| Incumbent | Recognizer shapes it ships | WE semantic delta |
|---|---|---|
| tldraw | Rectangle only ("brush" box-select). | Matches WE's exact state — one rect behavior, no vocabulary. |
| Excalidraw | Rect box-select first; **added free-form lasso later** (Douglas-Peucker-simplified closed path) on demand. | The canonical "second shape recurred" event (issues #6350 / #6494) — exactly the trigger this gate waits for. |
| Figma | Rect marquee native; lasso via plugin. | Two shapes, lasso opt-in — partial, demand-driven vocabulary. |
| Miro / Fabric / Konva | Single rect rubber-band. | Canvas libs ship one rect; the app layers other shapes. |
| Photoshop / GIMP | Rectangular + elliptical marquee, free-form lasso, **polygonal lasso**, magnetic lasso, **magic-wand**, nearest/center. | The mature end-state: a true shape *vocabulary*. Only graphics-grade tools reach it. |

WE semantic delta in one line: the web platform has **no** native region-select primitive (no
`Element.intersects()`; `IntersectionObserver` is viewport-relative, not rect-vs-rect), so every shape is
hand-rolled over Pointer Events + `setPointerCapture` + AABB/point-in-polygon over
`getBoundingClientRect`. WE owns exactly one shape today — the rectangle AABB — in the FUI block's pure
geometry core: fui:blocks/marquee-select/marqueeMath.ts:25 (bandRect), :35 (hitTest, with the #1406 Fork-2
intersect/contain/center mode at :19), :62 (resolveSelection over the replace/add/toggle/subtract modifier
vocab at :22); the controller fui:blocks/marquee-select/MarqueeSelect.ts:45 is thin glue, with the
a11y-parity keyboard equivalent extendByKeyboard at :38/:106.

**The pure-`selection` invariant (untouched by any verdict).** The
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json) intent stays pure — dimensions
`model` / `immediacy` / `variant` / `grouping` / `deselectable`, with no `scope`, no pointer, no rect.
#1406 Fork-1c rejected `scope: spatial` on `selection` (geometry has no place in the choice contract; it
would implicate non-spatial consumers like a radio group with hit-testing they cannot satisfy). Promotion
to a `region-select` intent would re-home the *gesture/geometry* layer (the `marqueeMath` core), **never**
push geometry into the choice contract.

## Dependencies & lineage

- **Origin:** Fork-1 residual of resolved
  [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/) (collected as a
  parked card, not lost as prose).
- **Parent:** [#099](/backlog/099-the-intent-layer-the-semantic-vocabulary/) (the intent layer).
- No backlog edge blocks this — it is gated on an **external** trigger (a second recognizer shape in
  demand), not on another item.

## Recommendation

**NOT-YET** — hold the `region-select` intent (YAGNI), confidence ~85%. WE ships one recognizer shape and
one realization; an intent now would invent a `shape` dimension with exactly one member — speculative
generality the *not-a-prioritization* and *most-permissive-default* rules don't license. The image-editor
family proves the end-state vocabulary is real, but only graphics-grade tools reach it; rect-only tools
(tldraw, Miro, the canvas libs) sit exactly where WE sits.

**Concrete un-gate trigger:** a *second* real recognizer shape recurs as demand — free-form **lasso** (the
Excalidraw precedent), **polygon**, or **center-point / nearest** — at which point a `region-select`
intent with `shape: rect | lasso | …` earns its home, with `marquee-select` as its first block and the
geometry layer re-homed off the single block. Until then this stays an open, unratified gate.

Skeptic: attacked NOT-YET by hunting for a second recognizer-shape consumer already in the tree — grepped
the backlog for lasso / polygon / free-form / magic-wand / nearest / region-select / center-point. The
only selection-recognizer hits are this card and #1406; the polygon / free-form hits elsewhere are
unrelated (hover-intent safe-area corridors #609/#643, governance/text contexts). **SURVIVES — no second
recognizer shape has real demand yet, so NOT-YET holds.** Had a real lasso/polygon consumer existed, the
verdict flips to GO.
