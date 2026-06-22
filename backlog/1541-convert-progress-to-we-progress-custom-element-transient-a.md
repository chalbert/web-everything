---
kind: story
size: 2
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, progress, frontierui]
---

# Convert progress to we-progress custom element (transient A)

Register the progress block as a we-progress custom element via the transient (A) mechanism, mirroring the shipping reference at fui:blocks/transient/TransientElement.ts. Behavior-free presentational control per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Flat application, no fork.
