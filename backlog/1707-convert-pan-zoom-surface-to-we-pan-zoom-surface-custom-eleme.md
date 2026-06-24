---
kind: story
size: 3
parent: "1442"
status: resolved
blockedBy: []
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1442
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, persistent-element, pan-zoom, frontierui]
---

# Convert pan-zoom-surface to we-pan-zoom-surface custom element (persistent light-DOM/B)

Package the pan-zoom-surface block as a persistent light-DOM custom element per the #1674 ruling (mechanism B, codified §7). Register we-pan-zoom-surface as a class extends HTMLElement that, on connect, wires createPanZoomSurface over its light-DOM viewport/content children and exposes the PanZoomHandle (setState/zoomBy/reset/getState + apply) as element methods/properties — no shadow root, so the surface keeps transforming and measuring the consumer's own content children directly. In-leak isolation rides the #1349 webisolation contract; shadow (C) stays available only as a #1349-S2 opt-in upgrade for a future hostile host. Mirror the stepper/deck/tabs persistent-B convert tasks.

## Progress (batch-2026-06-23-1725-1665) — DONE

Packaged pan-zoom-surface as a persistent light-DOM custom element (Mechanism B, #1674 §7), mirroring the stepper/deck/tabs persistent-B converts:
- `fui:blocks/pan-zoom-surface/PanZoomSurfaceElement.ts` — `class PanZoomSurfaceElement extends HTMLElement`. On connect it wires the existing `createPanZoomSurface` kernel over its light-DOM children: the **element is the viewport** (clipping container) and its first element child is the **content** (transformed layer) — **no shadow root**, so the surface transforms/measures the consumer's own content child directly. Exposes the `PanZoomHandle` (`getState`/`setState`/`zoomBy`/`reset`) as element methods, and the kernel options (`clamped`/`min-scale`/`max-scale`/`zoom-step`) as observed attributes (a live change re-initializes the kernel). `disconnectedCallback` destroys the handle.
- `fui:blocks/pan-zoom-surface/index.ts` — barrel exports the element + `registerPanZoomSurface()` (idempotent, consumer-overridable tag #841).
- `fui:blocks/__tests__/unit/pan-zoom-surface/PanZoomSurfaceElement.test.ts` — 5 tests green (persists in light DOM, no shadow root, scope-class on viewport, the handle control surface round-trips, disconnect teardown).

No persistent wrapper beyond the element itself, no imperative property surface beyond the handle methods (Mechanism C/shadow stays a #1349-S2 opt-in for a future hostile host). In-leak isolation rides the #1349 webisolation light-DOM unique-class floor. FUI gate 0 errors.
