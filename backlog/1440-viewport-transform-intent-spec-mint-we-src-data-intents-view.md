---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/intents/viewport-transform.json
tags: []
---

# viewport-transform intent spec — mint we:src/_data/intents/viewport-transform.json (bounds/focal/input dims, fixed keyboard+reset, composes interaction + #1396)

Author the viewport-transform intent ratified by #1393: a UX-only contract owning the surface viewport transform vocabulary — scaleExtent/translateExtent bounds, focal mode (pointer/center/fit), live input axes, and the non-negotiable keyboard +/-/0 + reset mechanic — composing interaction (modality) and #1396 (gesture recognition), rendering via CSS transform. Mirrors viewport-presence's owns-the-vocabulary-not-the-apply charter. Working name viewport-transform (final name confirmed at authoring per #1393 sub-fork).

## Progress

- **Status:** resolved
- **Done:** minted [we:src/_data/intents/viewport-transform.json](../src/_data/intents/viewport-transform.json) (id `viewport-transform`, status `draft`) with three dimensions — `bounds` (unbounded/clamped, default unbounded), `focal` (pointer/center/fit, default pointer), `input` (wheel/drag-pan/pinch/dblclick/keyboard, a set); keyboard +/-/0 + arrow-pan + reset authored as a **fixed mechanic** (not a dimension), mirroring Reorder's keyboard-parity contract; events `transform-start|change|end` + `reset`; full description HTML (what-it-is, dims, fixed mechanic, what-it's-NOT vs page-level VisualViewport/CSS `zoom`, composition, TS interface). Added glossary term [we:src/_data/semantics/viewport-transform.json](../src/_data/semantics/viewport-transform.json) (#1327 coverage). Name confirmed `viewport-transform` — the deliberate pair with `viewport-presence` (observe vs transform).
- **Verified:** valid JSON; `check:standards` adds 0 errors/0 warnings for this intent; live page `http://localhost:8080/intents/viewport-transform/` renders 200 with full content.
- **Next:** realizing block #1441 (`pan-zoom-surface`) — now unblocked.
