---
kind: decision
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1734
codifiedIn: "docs/agent/platform-decisions.md#vocabulary-completeness-early"
preparedDate: "2026-06-23"
relatedTo: ["1406"]
relatedReport: reports/2026-06-23-region-select-recognizer-shape-vocabulary.md
tags: [decision, selection, marquee, spatial, residual, validation-gate, ratified]
---

# Marquee recognizer-shape vocabulary — promote to a region-select intent?

## Digest

**RATIFIED 2026-06-24 — GO** (reverses the prepared demand-gated NOT-YET). Mint the `region-select` intent
now with a **full** `shape: rect | lasso | polygon | nearest` dimension, designed up front. The prepared
NOT-YET ("hold until a *second* recognizer shape recurs as demand") was **demand-gating a merit question** —
which the judge-on-merit rule forbids. On pure merit `region-select` is a coherent intent (a real recurring
semantic with no native web primitive) and `shape` is a real dimension: rect, lasso, and polygon all ship in
incumbents and **all four are specifiable now** from settled geometry (AABB; closed-path point-in-polygon;
vertex point-in-polygon; centroid). For a *standard*, designing the full vocabulary early is what matures
the platform and prevents a late shape forcing a breaking retrofit of the modifier/intersect contract —
completeness-early beats YAGNI (codified: we:docs/agent/platform-decisions.md#vocabulary-completeness-early).
Graduated to build epic **#1734**.

## What you're deciding

Whether to promote the marquee recognizer from a single behavior block to a cross-cutting
**`region-select` intent** carrying a **`shape: rect | lasso | polygon | nearest`** dimension — with the
existing [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/)
`marquee-select` block as its *first realization* (the `rect` shape). Promotion would lift the
gesture/geometry layer (band geometry + hit-testing + modifier resolution) into the intent and name the
recognizer shape as a configurable dimension. It is a go / no-go on building that intent, plus the trigger
that flips the gate.

## Why this isn't a classic fork (and is still a decision)

> **Superseded by the GO ruling.** This section framed the call as a one-sided *validation gate* waiting
> on external demand. The merit reframe (see Recommendation) reversed that: the question is a *merit*
> question, not a demand one, and the answer is GO now. Kept for the audit trail.

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
- **Resolved GO** → graduated to build epic **#1734**. (The prepared framing gated this on an external
  trigger — a second recognizer shape in demand — but the GO ruling discards that gate as demand-gating a
  merit question; nothing blocks the build.)

## Recommendation — RATIFIED GO (2026-06-24)

**GO** — mint `region-select` with the full `shape: rect | lasso | polygon | nearest` dimension, designed up
front. The prepared verdict was NOT-YET at ~85% on a YAGNI/"one member today" argument; the merit reframe
reversed it. Judge-on-merit asks two things, neither of which is demand: is the intent useful to a dev
anywhere (yes — a recurring spatial-selection semantic with no native web primitive), and does the `shape`
dimension pass the both-branches-are-real-end-states test (yes — rect, lasso, polygon all ship in
incumbents; all four are specifiable now from settled geometry). "Only one member is realized today" is
demand-gating, which judge-on-merit bars.

**Why design the full vocabulary now (the ratifying principle):** for a *standard*, the platform's value is
the coherence of the whole space, so having all the design in place early matures the platform and prevents
a late shape (the "outlier") from forcing a breaking retrofit of the modifier (replace/add/toggle/subtract)
and intersect (intersect/contain/center) contract. A named-but-incomplete dimension is an outlier waiting
to break the contract. Codified: we:docs/agent/platform-decisions.md#vocabulary-completeness-early.

**The one legitimate (non-demand) brake — wrong-abstraction risk** — is neutralized by completeness-early
itself: you cannot be surprised by a shape you already designed against, and the geometry of all four is
settled in incumbents, so they are specified against prior art rather than invented.

**Build:** epic **#1734** — mint the intent + full `shape` dimension, re-home the gesture/geometry layer
(`marqueeMath`) off the single block into the intent's realization contract, with #1406 `marquee-select` as
the `rect` realization and lasso (closed-path point-in-polygon, Douglas-Peucker simplified), polygon (vertex
point-in-polygon) and nearest (centroid) as the further members.

**The pure-`selection` invariant is untouched:** promotion re-homes the *gesture/geometry* layer into
`region-select`, never pushes geometry into the `selection` choice contract (#1406 Fork-1c stands).

Skeptic (prepared pass, now superseded): hunted for a second recognizer-shape consumer in the tree and
found none, concluding NOT-YET SURVIVES. That pass was answering a *demand* question; the ratification
turns on *merit*, where the absence of a second consumer is irrelevant — the shapes are specifiable from
prior art regardless. Independent re-verification (2026-06-24) confirmed the grep finding (only this card
and #1406 are real recognizer hits) but the verdict reverses on the merit reframe, not the demand count.
