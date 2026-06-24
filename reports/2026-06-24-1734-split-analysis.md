# Backlog split analysis — #1734 region-select intent + full shape vocabulary

**Date:** 2026-06-24
**Focus:** `/slice 1734` — slice the unsliced epic graduated from the #1463 GO ruling.
**Verdict:** **could split — 4 slices**, DAG `A → B → {C, D}`. One foundational WE slice (the intent
contract) gates three FUI realization slices.

## Context

#1734 is an unsliced `kind: epic` (size 13, parent #099) opened by the #1463 GO ruling: mint a cross-cutting
`region-select` intent carrying a full `shape: rect | lasso | polygon | nearest` dimension, designed up
front, with the gesture/geometry layer re-homed off the single `marquee-select` block into the intent's
realization contract — #1406 `marquee-select` becomes the `rect` member; lasso / polygon / nearest follow.
The fork is already settled at the parent (GO), so this is volume-not-fork; the slicing question is only
*where the seams fall*.

## Work-investigation pass (real tree)

The epic spans the constellation, and the seam is the constellation boundary itself:

- **WE owns the standard (definition only).** Intents are declarative JSON in
  [we:src/_data/intents/](../src/_data/intents/) (e.g. `we:selection.json`, `we:gesture.json`) — `id` /
  `name` / `dimensions` / `description` HTML / `requiresCapabilities`. Authoring the intent definition is
  permitted in WE (the zero-impl rule exempts definitions). `we:gesture.json` is the structural precedent
  for a recognizer-adjacent intent (UX-only dimensions; the engine is an impl seam, not part of the intent).
- **FUI owns the realizations (all impl).** The geometry + controller live in
  [fui:blocks/marquee-select/marqueeMath.ts](../../frontierui/blocks/marquee-select/marqueeMath.ts) —
  pure functions: `bandRect` (:23), `hitTest` over `MarqueeMode` intersect|contain|center (:37), `hitIds`
  (:50), `resolveSelection` over the `MarqueeModifier` replace|add|toggle|subtract vocab (:69),
  `modifierFromEvent` (:79), `passedThreshold` (:84); the controller
  [fui:blocks/marquee-select/MarqueeSelect.ts](../../frontierui/blocks/marquee-select/MarqueeSelect.ts) is
  thin Pointer-Events glue. Today this is rect-only (AABB). The non-rect members (lasso/polygon =
  point-in-polygon over a vertex list; nearest = centroid distance) are net-new geometry consuming a shared
  helper, not edits to the rect path.

So the foundational seam is the **intent contract** (WE) — it names all four shapes + the modifier/mode
contract, and every realization declares its `shape` value against it. The geometry **re-home** is the
first FUI slice (generalize the geometry core into a region-select module + re-point `marquee-select` as
the `rect` member); the non-rect members are independent FUI slices over that module.

## Could split — proposed slices

| Slice | Title | Repo / home | size | workItem | blockedBy | Demoable end-state |
|---|---|---|---|---|---|---|
| **A** | Mint the `region-select` intent — full `shape`/`mode`/`modifier` vocabulary | we:src/_data/intents/region-select.json | 3 | story | — | `/intents/region-select/` renders the full dimension set |
| **B** | Re-home the geometry core → shared region-select module + `rect` realization | fui:blocks/marquee-select/ | 3 | story | A | `marquee-select` unchanged (rect via the new module; regression-safe) |
| **C** | lasso + polygon realizations (point-in-polygon members) | fui:blocks/region-select/ | 3 | story | B | freehand-lasso + click-polygon select on a canvas demo |
| **D** | nearest realization (centroid member) | fui:blocks/region-select/ | 2 | task | B | nearest/centroid select on the demo |

**DAG:** `A → B → C`, `B → D`. C and D are mutually independent (both consume only B's shared module). Each
node leaves a valid demoable state; A is the only cross-cutting prerequisite.

**Batchable:** all four (each `size ≤ 3`, each independently deliverable). A is the natural first claim; B
unlocks C+D, which can then batch in parallel.

**Lasso vs polygon are one slice (C), not two:** both reduce to the same hit-test (point-in-polygon over a
vertex list) and differ only in the gesture that builds the vertex list (freehand drag + Douglas-Peucker
simplify vs click-to-add vertices) — splitting them would fragment one shared geometry helper across two
cards for no independence gain (the conservative-instinct call).

## Could not split

None. No slice buries a fork: the shape members are settled by the #1463 GO; geometry defaults
(Douglas-Peucker tolerance, polygon close-trigger, nearest = centroid per the ruling) are impl defaults
under POC-mode pragmatism, not roadmap forks.

## Rubric (all five hold)

1. **Volume not fork** — settled at the parent (#1463 GO). ✓
2. **≥2 nameable slices, real homes** — 4 slices, each `file:line`-citable (WE intents/, FUI blocks/). ✓
3. **Each ≤ 3 / task** — A:3, B:3, C:3, D:2. ✓
4. **Clean DAG, real independence** — A→B→{C,D}; C⊥D. ✓
5. **Every slice demoable** — intent page (A); regression-safe rect (B); per-shape demos (C, D). ✓
