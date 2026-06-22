---
kind: story
size: 3
parent: "1442"
status: open
blockedBy: ["1570"]
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, type-ahead, frontierui]
---

# Convert type-ahead to we-type-ahead custom element (support-both, persistent B)

Add a we-type-ahead element facade over the existing fui:blocks/type-ahead/TypeAheadBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.
