---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:blocks/data-grid/DataGridElement.ts"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, data-grid, frontierui]
---

# Convert data-grid to we-data-grid custom element (support-both, persistent B)

Add a we-data-grid element facade over the existing fui:blocks/data-grid/DataGridBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.

**Unblocked 2026-06-22 (#1570 resolved).** `DataGridBehavior` extends `CustomAttribute` and enhances an authored `<table role="grid">` in place (light-DOM scan), so the `StepperElement` mirror holds verbatim — no data-source fork. (A data-array-rendered grid via `fui:blocks/renderers/data-grid/renderDataGrid.ts`, if ever wanted, is a separate transient-A item, not this conversion.) The "shared trio fork" premise that put `blockedBy: 1570` on this card was factually wrong for data-grid.

## Progress

- **2026-06-22 — done.** Added `fui:blocks/data-grid/DataGridElement.ts` — the `<we-data-grid>` persistent light-DOM B-element over the existing `DataGridBehavior` `CustomAttribute` (`grid:cell-navigation`) kernel. Mirrors `StepperElement` verbatim (light-DOM-scan, no data-source fork per #1570): the author's `<table role="grid">` stays a light-DOM child and the kernel enhances it in place; the element finds the inner `[role="grid"]`, reflects its CEM config (`wrap` / `page-size`) onto the table where the kernel reads it, and attaches. `active` getter delegated through. Registration named `registerDataGridElement(tag='we-data-grid')` to disambiguate from the existing `registerDataGridBehavior`. Light-DOM FUI CSS injected once (#1349). Test `fui:blocks/__tests__/unit/data-grid/DataGridElement.test.ts` (6 cases, incl. an `auditDataGrid` clean-through) green; FUI `check:standards` 0 errors; typechecks clean.
