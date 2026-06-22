---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, data-grid, frontierui]
---

# Convert data-grid to we-data-grid custom element (support-both, persistent B)

Add a we-data-grid element facade over the existing fui:blocks/data-grid/DataGridBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.

**Unblocked 2026-06-22 (#1570 resolved).** `DataGridBehavior` extends `CustomAttribute` and enhances an authored `<table role="grid">` in place (light-DOM scan), so the `StepperElement` mirror holds verbatim — no data-source fork. (A data-array-rendered grid via `fui:blocks/renderers/data-grid/renderDataGrid.ts`, if ever wanted, is a separate transient-A item, not this conversion.) The "shared trio fork" premise that put `blockedBy: 1570` on this card was factually wrong for data-grid.
