---
kind: task
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1299"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/view/"
tags: []
---

# Migrate fui:view/for-each/data-grid/attributes target → ownerElement

Flip this.target → this.ownerElement across fui:blocks/view, fui:blocks/for-each, fui:blocks/data-grid, fui:blocks/attributes (8 CustomAttribute subclasses) + tests, after #1299's alias lands. Part of the #1299 webbehaviors carve.

## Progress

- Flipped `this.target` → `this.ownerElement` (49 occurrences) across the 8 subclasses:
  `fui:blocks/view/ViewBehavior.ts`, `fui:blocks/view/ViewShowBehavior.ts`,
  `fui:blocks/view/ViewSwitchDirective.ts`, `fui:blocks/view/ViewIfDirective.ts`,
  `fui:blocks/for-each/ForEachBehavior.ts`, `fui:blocks/data-grid/DataGridBehavior.ts`,
  `fui:blocks/data-grid/DataGridEditBehavior.ts`, `fui:blocks/attributes/on-event/OnEventAttribute.ts`.
  The `event.target` reads (DataGrid behaviors, OnEventAttribute) were left untouched (literal
  `this.target` only).
- Full FUI suite green — 2425 passed / 9 skipped / 0 failed.
