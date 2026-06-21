---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, zoom, pan, viewport, gap, interaction]
---

# Zoom / pan a surface — viewport scale + translate standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): scaling and
translating a content surface (image viewer, map, canvas, diagram, zoomable timeline) under pointer /
wheel / pinch / keyboard, with a viewport transform, bounds, and zoom-to-fit / zoom-to-point. WE owns no
zoom/pan concern today.

**Decision:** where does it live and what's its shape — its own intent, a behavior
composing `interaction` (modality) + a transform model, or a block — and how it relates to gestures
([#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/)) and CSS
transforms / `zoom`. Native-first substrate to check in prep: CSS transform + transform-origin, wheel +
Pointer Events, `touch-action`, the CSS `zoom` property's status. **Needs `/prepare`.** Unsure ⇒ decision
(à la [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)); costs nothing
if prep finds it folds into an existing concern.
