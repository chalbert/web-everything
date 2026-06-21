# Prep research — Pointer gestures (swipe / long-press / pinch / pull-to-refresh): placement & shape (#1396)

**Date:** 2026-06-21 · **Decision:** [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)
· **Parent:** [#099](/backlog/097-roadmap-to-mvp/) (evergreen-app north star, verb-axis lens)
· **Surfaced by:** verb-axis gap lens [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)

## The gap

Web Everything owns no concern for a **recognized-gesture vocabulary** — swipe, long-press, pinch,
rotate, pull-to-refresh, two-finger pan — the layer between raw Pointer Events and the UX action a
gesture triggers. The verb-axis lens flagged it as a `~` row: `interaction` owns input **modality**
but not specific gestures. The nearest pieces all miss it:

- `we:src/_data/intents/interaction.json:6-15` owns the input **modality** dimension
  (`pointer | touch | gamepad`) — *which device/coarseness shapes the patterns*, an **ambient,
  document-level, singular** value. Its description (`we:src/_data/intents/interaction.json:16`) already name-drops
  "**Swipe actions** replace hover menus" under `touch`, but there is **no gesture vocabulary** — it
  asserts a consequence of touch modality, it does not model a per-element gesture binding.
- `we:src/_data/intents/data-transfer.json` owns copy/cut/paste/drag-**payload** (the DnD data
  contract), not the recognition of a drag/pan *gesture*.
- `we:src/_data/intents/reorder.json` owns user-mutable 1-D **collection order** — a consumer of a
  drag gesture, not the recognizer.

## Native substrate (checked, not asserted)

| Primitive | Status | Verdict for gestures |
|---|---|---|
| **Pointer Events** (`pointerdown/move/up`, `pointerId`, `pressure`, `tiltX/Y`, `setPointerCapture`) | Baseline | The **substrate** every recognizer is built on — unifies mouse/touch/pen, and multi-pointer tracking (two `pointerId`s) is how pinch/rotate are computed. |
| `touch-action` CSS (`none`, `pan-x`, `pan-y`, `pinch-zoom`, `manipulation`) | Baseline | The **opt-out**: set `touch-action: none` so the browser doesn't consume the gesture (scroll/pinch-zoom) before the JS recognizer sees the pointers. |
| `overscroll-behavior` CSS (`contain`, `none`) | Baseline | Governs the browser's **native pull-to-refresh** + scroll-chaining/glow — the one gesture the platform partly ships. Custom PTR opts out via this. |
| `contextmenu` event | Baseline | The native **long-press** signal on touch (fires `contextmenu`); a recognizer must coordinate with it. |
| `VisualViewport` API | Baseline | Page-level pinch-zoom observation only — whole-document, read-only; not an element-scoped gesture source. |
| Safari `GestureEvent` (`gesturestart/change/end`, `scale`, `rotation`) | **Non-standard, Safari-only, deprecated** | Gives scale+rotation but is **not a standard** — do not build on it. The tell that there is no cross-browser gesture event. |
| Native **high-level gesture recognizer** (a `swipe`/`longpress`/`pinch` event) | **None** | The library tell — every incumbent ships a JS recognizer. |

So the platform gives the *raw input* (Pointer Events) and the *opt-out* (`touch-action`) but **no
native gesture recognizer** and **no gesture event vocabulary**. The reusable middle —
recognize-a-named-gesture-from-pointers + its a11y-equivalent — is unhomed.

## A11y is non-negotiable, and the platform names the rule

The parity requirement the item calls out is **codified in WCAG**, so the vocabulary is borrowed, not
invented:

- **WCAG 2.1 SC 2.5.1 Pointer Gestures (Level A)** — all functionality using *multipoint or path-based*
  gestures must also be operable with **a single pointer without a path-based gesture**, unless
  essential. (Pinch, two-finger pan, swipe-path all fall under this.)
- **SC 2.5.2 Pointer Cancellation (A)** — the action fires on *up*, not *down*, and is abortable.
- **SC 2.5.4 Motion Actuation (A)** — a motion/gesture trigger must have a conventional-control
  equivalent.

This makes "a gesture is never the only path" a **fixed invariant** (a ratify), not a fork: every
gesture binding declares a single-pointer / keyboard equivalent. This rhymes with the in-tree
precedent on `we:src/_data/intents/hover-intent.json:22-28`, whose `touch` dimension exists precisely
*because hover has no touch equivalent* — gestures carry the mirror obligation (no keyboard/pointer
equivalent ⇒ no gesture).

## Prior art — the incumbents (all JS, convergent vocabulary)

| Library / platform | Model | What it proves |
|---|---|---|
| **Hammer.js** | Per-gesture **Recognizer** objects (`tap`, `doubletap`, `press`=long-press, `pan`, `swipe`, `pinch`, `rotate`) with a state machine (possible→began→changed→ended/cancelled/failed) and `requireFailure` / `recognizeWith` relations | The canonical web gesture vocabulary + the recognizer-as-pluggable-unit model. |
| **@use-gesture** (`/core` + React/Vue bindings) | Framework-agnostic core over Pointer Events; handlers `onDrag/onPinch/onWheel/onMove/onHover` yielding `movement`, `offset`, `velocity`, `direction`, `cancel` | The modern reference: a neutral core with framework adapters — exactly WE's contract-vs-impl split. |
| **interact.js** | `draggable` / `resizable` / `gesturable` (pinch+rotate) with inertia + snapping | Same vocabulary, recognizer composed with effects (resize/snap → overlaps #1384). |
| **React Native Gesture Handler / SwiftUI Gesture / Flutter GestureDetector / Jetpack Compose `detect*Gestures` / iOS UIGestureRecognizer** | Native frameworks each ship a recognizer set: tap, double-tap, long-press, pan/drag, swipe/fling, pinch/magnify, rotate, screen-edge-pan | Cross-platform convergence on **one vocabulary** — strong evidence the gesture set is a standardizable axis, not a per-library invention. |

**Convergent vocabulary** across web + native: `tap`, `double-tap`, **`long-press`**, `pan`/`drag`,
**`swipe`**/`fling` (+ direction + velocity), **`pinch`** (scale), `rotate`, `two-finger pan`,
`edge-swipe`, and the mobile-web pattern **`pull-to-refresh`** (partly native via `overscroll-behavior`).
Every system separates **recognition** (the gesture) from the **effect** it drives (dismiss, page,
zoom, refresh) — the seam WE should adopt.

## Classification (per-fork classification pass)

- **Which layer?** The declarative UX "what" — *this element is swipe-dismissable / pinch-zoomable /
  long-press-actionable* → **intent**. No single component owns gestures (a card, an image, a list row
  all bind them), so it is **not a block**; the recognizer *impl* is runtime behavior (a plug/DI
  provider), not the standard surface.
- **Protocol or intent dimension?** Intent for the **declaration**. The *recognizer engine* (native
  Pointer-Events math vs Hammer vs @use-gesture) is a swappable impl — but per
  `we:docs/agent/platform-decisions.md` (minimize-lock-in: a protocol is the single escapable lock,
  reached for only on a real interop need) it is a **DI/behavioral seam + a Technical Configurator
  card**, *not* a protocol minted now. This mirrors `hover-intent` exactly: the *mechanic*
  (delay vs CSS safe-area vs JS polygon) is a Configurator card, not the intent
  (`we:src/_data/intents/hover-intent.json:6,30`).
- **Expose the whole axis?** The gesture **vocabulary** is an open dimension (standardize the set +
  recommended core, authors extend — mirrors the intents-are-open-design rule). The **a11y equivalent**
  is a **fixed mechanic** (WCAG 2.5.1), never a dimension.
- **DI-injectable?** Yes — the recognizer is **behavioral**, resolvable via the Ambient Intent / DI
  channel (native-first default), not hardcoded on the element.
- **Most-permissive default?** No gesture is mandated; a binding is opt-in; the equivalent fallback is
  always present (the restriction — "gesture-only" — is forbidden, never the default).
- **Seam between intents?** Gesture = **recognition**; the effect lives elsewhere — pinch → #1393
  viewport transform; swipe → carousel paging; long-press → `contextmenu`/`command`; pan/drag →
  `data-transfer`/`reorder`. Name each seam; none is a conflict, all are compositions.

## The placement fork — separate intent vs a dimension on `interaction`

Both branches are coherent (you *could* add a `gestures` dimension to `interaction`, OR mint a separate
intent), and the concern has exactly one home — a genuine either/or (fork case (b)). The decisive
**in-tree precedent** points to separation: WE has **consistently carved interaction-adjacent concerns
into their own intents** rather than folding them into `interaction` —
**Focus Delegation Intent** (`we:src/_data/intents/focus-delegation.json`) and **Hover Intent**
(`we:src/_data/intents/hover-intent.json`) are both standalone intents that *compose* `interaction`
(the latter's `description` ends by naming the Interaction-Intent composition seam). The merit reason
behind the precedent: `interaction`'s `modality` is an **ambient, document-level, singular** value
(what device is the user on); a gesture binding is a **per-element, plural** declaration (this card
swipes, that image pinches). Folding per-element plural bindings into the ambient-singular modality
intent conflates two scopes and dilutes modality with a verb — the same dilution the #1393 prep rejects
for zoom/pan. So: **a separate `gesture` intent that composes `interaction` (gated to pointer/touch
modality), mirroring `focus-delegation` / `hover-intent`.** Confidence **med-high** — the residual is
purely whether the ambient-vs-per-element scope argument is decisive enough to outweigh "one fewer
intent"; the precedent makes it so.

The "dimension on `interaction`" branch is not *broken*, just inferior on merit (scope/cardinality
mismatch), so this stays a genuine fork with a strong default, not a forced invariant.

## Recommendation (carried into the prepared forks)

A **distinct standard earns a home**: a new **`gesture` intent** (working name) modeling the convergent
recognizer vocabulary (`tap · double-tap · long-press · pan · swipe · pinch · rotate · two-finger-pan ·
edge-swipe · pull-to-refresh`) as an **open dimension**, composing `interaction` (gated to
pointer/touch), with a **fixed a11y invariant** (single-pointer/keyboard equivalent, WCAG 2.5.1), the
**recognizer engine native-first** over Pointer Events + `touch-action` with a DI override + a Technical
Configurator card (mirroring `hover-intent`). The recognition/effect seam is named to the sibling
consumers (#1393 pinch, carousel swipe, `data-transfer` drag, `command`/`contextmenu` long-press). A
full **Gesture Recognizer Protocol** is a *deferred, separately-prioritized* candidate (no interop need
today), not part of this placement call.

## Sources

- [Pointer events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [touch-action — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [overscroll-behavior — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [WCAG 2.1 — SC 2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures.html)
- [Hammer.js — recognizers](https://hammerjs.github.io/)
- [@use-gesture documentation](https://use-gesture.netlify.app/)
- [GestureEvent (non-standard, Safari) — MDN](https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent)
