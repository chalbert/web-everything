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
tags: [packaging, custom-elements, block-model, conversion, data-grid, frontierui]
---

# Convert data-grid to we-data-grid custom element (support-both, persistent B)

Add a we-data-grid element facade over the existing fui:blocks/data-grid/DataGridBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.
