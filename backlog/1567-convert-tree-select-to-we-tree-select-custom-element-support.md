---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, tree-select, frontierui]
---

# Convert tree-select to we-tree-select custom element (support-both, persistent B)

Add a we-tree-select element facade over the existing fui:blocks/tree-select/TreeSelectBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.
