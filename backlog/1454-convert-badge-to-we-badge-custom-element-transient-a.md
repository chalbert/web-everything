---
kind: task
parent: "1442"
status: open
dateOpened: "2026-06-21"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, badge, frontierui]
---

# Convert badge to we-badge custom element (transient/A)

Behavior-free presentational control: replace the createBadge factory with registerBadge(tag='we-badge') via the TransientElement pattern. Mechanism A by the codified guideline (we:docs/agent/block-standard.md Packaging governance §7); tag derives cleanly by #841. Independent of the other conversions.
