# Marquee / rubber-band selection — 2-D drag-select placement survey

Prior-art survey grounding decision [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/)
(verb-axis straggler of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

Drag a rectangle over a 2-D surface (canvas, file grid, board, diagram) to select everything it
intersects, with additive (Shift) / toggle (Ctrl) modifiers and a keyboard equivalent. The `selection`
intent owns single/multi *choice* over a collection, **not** the spatial drag-select gesture.

## Native grounding — there is no native marquee primitive

The platform ships only the raw substrate; the recognize-a-rectangle-and-hit-test middle is unhomed:

- **Pointer Events + `setPointerCapture()`** (Baseline) — `pointerdown` on the empty surface starts the
  band, `pointermove` grows it, `pointerup` commits; capture keeps events flowing while the pointer leaves
  the surface mid-drag. (The same substrate #1384 and resolved #1396 bake.)
- **Geometry, hand-rolled** — `Element.getBoundingClientRect()` per candidate tested against the band rect
  via AABB (axis-aligned bounding box) intersection. There is no `Element.intersects()`;
  `IntersectionObserver` is viewport/root-relative, not rect-vs-rect, so it does **not** apply. Candidates
  are enumerated by selector.
- **Drag threshold + edge auto-scroll** are convention, not platform: a ~10px move threshold separates a
  click from a band; a `requestAnimationFrame` loop scrolls when the pointer nears a container edge.
- **a11y (load-bearing):** there is **no WAI-ARIA APG pattern for rubber-band/marquee selection** — a
  spatial sweep has no keyboard analog. The accessible model APG *does* define is **Listbox / Grid
  multi-select via keyboard** (arrows to move, Shift+Arrow to extend a contiguous range, Ctrl+Space to
  toggle, Ctrl+A select-all, `aria-multiselectable`, `aria-selected`). So a keyboard equivalent is not
  polish — it is the *only* conformant path to the same outcome (WCAG 2.1 SC 2.5.1), and it lands on the
  contract `selection` already owns. This mirrors #1396's a11y-parity invariant verbatim.

## Finding 1 (load-bearing) — every benchmark decouples the gesture from the selection set

Marquee universally *produces* a selection set; it is never a property of the choice widget.

| System | Shape |
| --- | --- |
| [Fluent UI `MarqueeSelection`](https://learn.microsoft.com/en-us/javascript/api/react-internal/marqueeselection) | a distinct component that wraps content and *feeds* a separate `Selection` object ("generically stores selection state") — geometry and selection-state are two things, composed |
| [react-selecto](https://github.com/daybrush/selecto) | a standalone component that emits selected elements; the app owns what "selected" means |
| [Adobe Spectrum `roving-tab-index`-style tools / @air/react-drag-to-select](https://www.joshuawootonn.com/react-drag-to-select) | the canonical algorithm: track the band as a *vector* (works in all four drag directions), `setPointerCapture`, 10px threshold, AABB `intersect`, edge auto-scroll within 20px |
| [tldraw "brush" / Rete.js lasso-marquee](https://retejs.org/examples/lasso-marquee-selection/) | box-select is a *tool/behavior* layered on a surface that yields a selection, not a widget config |

The decisive signal: the spatial gesture and the selection set are universally **decoupled**.

## Finding 2 — selection-mode (intersect vs contain) is a first-class, named knob everywhere

CAD/design tools (Chief Architect "window vs crossing", AutoCAD, Figma, Miro, tldraw) expose: object must
be *fully contained* by the band, *intersected* by it, or its *center point* contained. This is the one
genuine non-trivial dimension marquee adds beyond the gesture itself.

## Finding 3 — modifier vocabulary converges

additive (Shift), toggle (Ctrl/Cmd), subtract (Alt), replace (no modifier) — identical across Finder, VS
Code explorer, Figma, tldraw, react-selecto.

## WE-tree decomposition

**[we:src/_data/intents/selection.json](../src/_data/intents/selection.json)** is a pure *choice
contract*, zero geometry/pointer: `model: single | multiple`, `immediacy: live | buffered`, `variant:
boolean | item | range`, `grouping: flat | grouped`, interface `SelectionModel` / `constraints {min,max}`.
Its summary: "choice behaviors … distinguishing interactions from form data." No `scope`, no pointer, no
rect, no hit-testing.

The pointer/spatial family it sits beside:
[we:src/_data/intents/reorder.json](../src/_data/intents/reorder.json) (user-mutable *order*, 1-D, owns
the Pointer-Events + keyboard substrate), [we:src/_data/intents/data-transfer.json](../src/_data/intents/data-transfer.json)
(typed-payload drag/drop), the resolved `gesture` intent (#1396 — per-element recognized gestures
composing `interaction`, WCAG 2.5.1 baked).

**Cluster boundaries.** [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)
(spatial-manipulation) owns *moving/resizing/arranging* surfaces — verb = *manipulate*; marquee's verb =
*choose*. [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)
(gestures, resolved) recognizes per-element gestures; marquee is a `gesture`-recognized **pan** whose
*effect* is a selection — the missing fourth effect-seam in #1396's "pan → data-transfer / reorder" list.

**The unowned residual:** the **rectangle-sweep-to-selection behavior** — band geometry + AABB hit-testing
+ selection-mode + modifier semantics + drag threshold + edge auto-scroll + the keyboard equivalent that
yields the same multi-selection. `selection` owns the *resulting set*; nothing owns the *spatial gesture
that computes it*.

## Recommended placement

- **Fork 1 — home:** a **`marquee-select` behavior block** composing `selection` (the output set) + the
  resolved `gesture` pan recognizer, with the keyboard equivalent routing into `selection`'s `model:
  multiple` (~80%). `selection` stays the pure choice contract — `scope: spatial` is the *broken* branch
  (it would force the choice-contract intent to own `getBoundingClientRect` hit-testing, AABB math, and
  edge auto-scroll, implicating every existing consumer e.g. a radio group with geometry it can't
  satisfy). Residual: behavior-block vs a standalone `marquee`/`region-select` intent pivots on whether a
  free-form lasso + other recognizer shapes recur; lean behavior now (YAGNI on the intent).
- **Fork 2 — selection-mode default:** `intersect` (touch-to-select, the forgiving default Finder/Figma
  use), with `mode: intersect | contain | center` exposed as a dimension (~85%, most-permissive default).

Baked invariants (not forks): the keyboard equivalent (no ARIA marquee pattern exists → only conformant
path, WCAG 2.5.1); native Pointer Events + AABB over `getBoundingClientRect`; the modifier vocabulary;
drag threshold + edge auto-scroll; recognizer engine = native default + DI override + Configurator card,
no protocol minted now (minimize-lock-in, same disposition as #1396). Rectangle only; free-form lasso is a
distinct recognizer shape, out of scope here.
