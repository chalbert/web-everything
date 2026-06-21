---
kind: story
size: 5
status: open
blockedBy: ["1440"]
dateOpened: "2026-06-21"
tags: []
---

# pan-zoom-surface block — realizing build for the viewport-transform intent (clamp/focal math, keyboard, CSS transform apply)

The deferred realizing block for the viewport-transform intent (#1393 ratified placement; #1440 spec). Ships the per-surface wiring once so consumers don't re-implement it: viewport transform-state {translate, scale}, scaleExtent/translateExtent clamping, focal-point math (zoom-to-cursor/center/fit), keyboard +/-/0 + arrow-pan, applied via CSS transform: scale()/translate() (GPU compositor, paint-only) with touch-action:none ceding native pinch. SVG/canvas surfaces apply the same state to viewBox/context. Earns a block (not a doc-only pattern) per the #409 reasoning — non-trivial shared math across image/map/canvas/diagram surfaces.
