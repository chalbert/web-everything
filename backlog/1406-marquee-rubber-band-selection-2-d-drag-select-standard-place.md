---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: one-off
tags: [decision, book-candidate, selection, marquee, spatial, gap, interaction]
relatedReport: reports/2026-06-21-marquee-rubber-band-selection-placement.md
preparedDate: "2026-06-21"
---

# Marquee / rubber-band selection — 2-D drag-select standard: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
drag a rectangle over a 2-D surface (canvas, file grid, board, diagram) to select everything it
intersects, with additive (Shift) / toggle (Ctrl) modifiers and a keyboard equivalent
([prior-art survey](/research/marquee-rubber-band-selection-placement/)). The
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json) intent owns single/multi
*choice* over a collection (`model`, `immediacy`, `variant`, `grouping` — no `scope`, no pointer, no
rect), **not spatial drag-select.**

The axis the prep pins to the real tree: marquee universally *produces* a selection set but is never a
property of the choice widget. There is **no native marquee primitive** — only Pointer Events +
`setPointerCapture` + hand-rolled AABB geometry over `getBoundingClientRect` (`IntersectionObserver` is
viewport-relative, not rect-vs-rect, so it does not apply). And there is **no WAI-ARIA APG pattern** for a
rubber-band sweep, so the only conformant path to the same outcome is the APG Listbox/Grid keyboard
multi-select model (Shift+Arrow range-extend, Ctrl+Space toggle) routing straight into `selection`'s
`model: multiple` (WCAG 2.1 SC 2.5.1, mirroring resolved #1396). Every benchmark *decouples* the gesture
from the set: Fluent `MarqueeSelection` feeds a separate `Selection` object; react-selecto emits elements
the app interprets; tldraw's "brush" / Rete's lasso-marquee are tools layered on a surface. The unowned
residual is the **rectangle-sweep-to-selection behavior** — band geometry + AABB hit-testing +
selection-mode + modifiers + edge auto-scroll + the keyboard equivalent — which composes
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json) and the resolved `gesture` pan
recognizer ([#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)).

### Triage context

- **Kind**: Behavior block (composes `selection` + `gesture`) · **Native grounding**: Pointer Events + `setPointerCapture`, AABB over `getBoundingClientRect`; APG Listbox/Grid keyboard multi-select (no native marquee)
- **Native-first**: ▽ low (no native primitive; adopt the keyboard a11y model) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1390 (verb-axis straggler) · **Cluster**: overlaps #1384 (spatial-manipulation), #1396 (gestures)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home** | a **`marquee-select` behavior block** composing `selection` + the `gesture` pan recognizer | `scope: spatial` dimension on `selection` *(rejected — geometry has no place in the choice contract)* · a standalone `marquee` intent | **~80%** — universal prior-art decoupling; selection stays pure |
| **2 · selection-mode default** | **`intersect`** (touch-to-select), `mode: intersect \| contain \| center` exposed | `contain` default *(rejected — less permissive)* | **~85%** — most-permissive default; both values are legitimate end-states |

## Fork 1 — where does the rectangle-sweep-to-selection behavior live?

*Fork-existence:* the excluded branch is **`scope: spatial` on `selection`**, and it is **broken** —
adding it would force the pure choice-contract intent to own `getBoundingClientRect` hit-testing, AABB
math, the pointer-drag lifecycle and edge auto-scroll, none of which "distinguishing interactions from
form data" has any business owning; it would also implicate every existing `selection` consumer (a radio
group, a multi-select list) with geometry it cannot satisfy. That is the codified
`decompose-overloaded-vocabulary-by-semantic-source` rule — marquee supplies *none* of `selection`'s
defining inputs. A single home that has to either carry geometry or strand it is the genuine either/or.

**Fork 1 (a) — a `marquee-select` behavior block composing `selection` + the `gesture` pan recognizer
(recommended, ~80%).** It owns the geometry/lifecycle residual; `selection` stays the crisp choice
contract; it reuses the resolved `gesture` recognizer substrate and #1384's Pointer-Events / a11y
baseline; the keyboard equivalent routes into `selection`'s existing `model: multiple`. Matches the
universal prior-art decoupling (Fluent, react-selecto) and the intent-vs-behavior layering.

**Fork 1 (b) — a standalone `marquee` / `region-select` intent composing `selection`.** Coherent, but
marquee is a concrete *mechanic* (one rectangle gesture, one algorithm) bound to a surface — what WE calls
a behavior/block — not a cross-cutting UX intent like "choose / reorder / gesture." Mint an intent only if
a recognizer vocabulary beyond the rectangle emerges.

**Fork 1 (c) — `scope: spatial` dimension on `selection` (rejected).** The broken branch above.

*The residual (~20%):* (a) vs (b) is the live tension. If a free-form **lasso** + center-point + multiple
recognizer shapes prove to be a recurring vocabulary (not just the rectangle), a `marquee` / `region-select`
intent with a `shape: rect | lasso` dimension may earn its own home, with `marquee-select` as its first
block. Lean behavior now (YAGNI on the intent); revisit if a second recognizer shape lands. Either way,
`selection` stays pure — so the residual does not touch the rejection of (c).

## Fork 2 — default selection-mode

*Fork-existence:* both `intersect` and `contain` are legitimate end-states, so the axis is correctly a
configurable dimension, not a fork over which is "right." The genuine call is only the **default** — and
the less-permissive value as the default is the excluded branch (most-flexible-default: the restriction is
the author's opt-in, never the floor).

**Fork 2 (a) — `intersect` default (touch-to-select); expose `mode: intersect | contain | center`
(recommended, ~85%).** Finder, file grids and Figma all default to the forgiving touch-to-select;
`contain` is the CAD-precision opt-in. Most-permissive default.

**Fork 2 (b) — `contain` default (rejected).** Less permissive; violates most-flexible-default.

*The residual:* none material — both values ship as the dimension; only the default is chosen.

## Ruling — ratified 2026-06-21

- **Fork 1 → (a):** the rectangle-sweep-to-selection residual lives in a **`marquee-select` behavior block**
  composing [we:src/_data/intents/selection.json](../src/_data/intents/selection.json) + the resolved
  `gesture` pan recognizer ([#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)).
  `selection` stays the pure choice contract; `scope: spatial` (1c) stays **rejected**
  (`decompose-overloaded-vocabulary-by-semantic-source`). Red-team of 1(b) (standalone intent) failed —
  one rectangle/one algorithm is a surface-bound mechanic, not a cross-cutting intent (YAGNI).
- **Fork 2 → (a):** default selection-mode is **`intersect`** (touch-to-select); `mode: intersect | contain |
  center` exposed (most-flexible-default).
- **Fork-1 residual collected → parked [#1463](/backlog/1463-marquee-recognizer-shape-vocabulary-promote-to-a-region-sele/)**:
  promote to a `region-select` intent (`shape: rect | lasso | …`) **iff a second recognizer shape recurs**;
  not lost as prose.
- **Realizing build** (author the `marquee-select` block + keyboard-equivalent + `mode` dimension + demo)
  is separately prioritized below — not part of this placement call.

---

### Supported by default (not forks)

- **a11y-parity invariant (forced, not a fork).** Every `marquee-select` declares a keyboard equivalent
  that produces the same `selection` set — the pointer-only branch is broken (no ARIA marquee pattern
  exists; WCAG 2.1 SC 2.5.1). Mirrors #1396 verbatim.
- **Native substrate.** Pointer Events + `setPointerCapture`, never HTML DnD; AABB over
  `getBoundingClientRect`. Shared with #1384 / #1396.
- **Modifier vocabulary.** `replace | add (Shift) | toggle (Ctrl/Cmd) | subtract (Alt)` — standardize the
  convergent core.
- **Drag threshold + edge auto-scroll** = baked mechanics (convention, not a fork).
- **Recognizer engine** = native math default + DI override + Configurator card; no protocol minted now
  (minimize-lock-in, same disposition as #1396).
- **Intent contract + FUI behavior-block realization coexist** at different layers.
- **Rectangle only; free-form lasso out of scope** for this item (a distinct recognizer shape — see
  Fork 1 residual).

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: author the `marquee-select` behavior block (composing `selection` + `gesture`),
its keyboard-equivalent contract, the `mode` dimension, and a demo over a file-grid / board surface. File
via `/new-standard`. Not part of this placement call.
