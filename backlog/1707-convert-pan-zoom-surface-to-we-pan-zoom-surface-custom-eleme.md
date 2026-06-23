---
kind: story
size: 3
parent: "1442"
status: open
blockedBy: []
dateOpened: "2026-06-23"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, persistent-element, pan-zoom, frontierui]
---

# Convert pan-zoom-surface to we-pan-zoom-surface custom element (persistent light-DOM/B)

Package the pan-zoom-surface block as a persistent light-DOM custom element per the #1674 ruling (mechanism B, codified §7). Register we-pan-zoom-surface as a class extends HTMLElement that, on connect, wires createPanZoomSurface over its light-DOM viewport/content children and exposes the PanZoomHandle (setState/zoomBy/reset/getState + apply) as element methods/properties — no shadow root, so the surface keeps transforming and measuring the consumer's own content children directly. In-leak isolation rides the #1349 webisolation contract; shadow (C) stays available only as a #1349-S2 opt-in upgrade for a future hostile host. Mirror the stepper/deck/tabs persistent-B convert tasks.
