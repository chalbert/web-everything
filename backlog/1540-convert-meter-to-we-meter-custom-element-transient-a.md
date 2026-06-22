---
kind: story
size: 2
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-2.md
tags: [packaging, custom-elements, block-model, conversion, meter, frontierui]
---

# Convert meter to we-meter custom element (transient A)

Register the meter block as a we-meter custom element via the transient (A) mechanism, mirroring the shipping reference at fui:blocks/transient/TransientElement.ts. Behavior-free presentational control per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Flat application, no fork.
