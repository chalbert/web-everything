---
kind: story
size: 5
status: resolved
locus: frontierui
blockedBy: ["1440"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/pan-zoom-surface/PanZoomSurface.ts"
tags: []
---

# pan-zoom-surface block — realizing build for the viewport-transform intent (clamp/focal math, keyboard, CSS transform apply)

The deferred realizing block for the viewport-transform intent (#1393 ratified placement; #1440 spec). Ships the per-surface wiring once so consumers don't re-implement it: viewport transform-state {translate, scale}, scaleExtent/translateExtent clamping, focal-point math (zoom-to-cursor/center/fit), keyboard +/-/0 + arrow-pan, applied via CSS transform: scale()/translate() (GPU compositor, paint-only) with touch-action:none ceding native pinch. SVG/canvas surfaces apply the same state to viewBox/context. Earns a block (not a doc-only pattern) per the #409 reasoning — non-trivial shared math across image/map/canvas/diagram surfaces.

## Progress (batch-2026-06-21)

- Pre-flight state-fix: set `locus: frontierui` (was unset → defaulted to we; the realizing block is
  runtime math/impl per #855/#817, like the meter block — WE owns the viewport-transform intent #1440, FUI
  the block).
- **Pure math** `fui:blocks/pan-zoom-surface/panZoomMath.ts` — `clampScale`, `clampTranslate` (the
  `bounds: clamped` dimension: edges-inside when larger, centre when smaller), `zoomAtPoint` (focal-point
  zoom keeping the point under the cursor fixed — `focal: pointer|center`), `fitTransform` (`focal: fit`),
  `toCssTransform`. Unit-testable without a DOM.
- **Controller** `fui:blocks/pan-zoom-surface/PanZoomSurface.ts` — `createPanZoomSurface(viewport, content,
  options)`: holds {translate, scale}, wires wheel(zoom-at-pointer)/drag-pan/dblclick/keyboard(+/−/0/arrows),
  sets `touch-action:none` (cedes native pinch), applies `transform: translate()/scale()` (GPU compositor),
  emits `transform-start/change/end` + `reset` events; SVG/canvas surfaces pass a custom `apply`. All math
  is the pure core (thin glue). Registered in `fui:src/_data/blocks.json` (completeness gate).
- **Demo** `fui:demos/pan-zoom-surface-demo.html` — a draggable/zoomable grid with zoom/reset buttons +
  a live state readout. Verified live on :3001: zoom-in 1.00→1.25 applies `translate(132.5px,-45px)
  scale(1.25)`.
- 8 unit tests `fui:blocks/__tests__/unit/pan-zoom-surface/panZoomMath.test.ts` (clamp, focal-fixed-point,
  bounds, fit, css). FUI `check:standards` → 0 errors; pan-zoom typechecks clean.
