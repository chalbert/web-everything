---
kind: task
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1299"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/droplist/"
tags: []
---

# Migrate fui:droplist behaviors target → ownerElement

Flip this.target → this.ownerElement across fui:blocks/droplist/* (8 CustomAttribute subclasses, ~150 occ) + their unit tests, after #1299's alias lands. Alias keeps the area green throughout. Part of the #1299 webbehaviors carve (see we:reports/2026-06-20-backlog-split-analysis.md).

## Progress

- Flipped `this.target` → `this.ownerElement` (150 occurrences) across the 8 droplist CustomAttribute
  subclasses: `fui:blocks/droplist/Anchor.ts`, `fui:blocks/droplist/Anchored.ts`,
  `fui:blocks/droplist/Clearable.ts`, `fui:blocks/droplist/Filter.ts`,
  `fui:blocks/droplist/FocusDelegation.ts`, `fui:blocks/droplist/LiveStatus.ts`,
  `fui:blocks/droplist/Selection.ts`, `fui:blocks/droplist/Windowed.ts`. Spot-checked that
  `event.target` (`fui:blocks/droplist/Anchor.ts`) and prose comments were untouched (literal
  `this.target` only).
- No droplist test referenced `.target`, so no test edits were needed. Droplist suites green: 108/108
  (`npx vitest run blocks/droplist/`).
- FUI `check:standards`: the only 2 errors are pre-existing catalog-completeness drift in
  `fui:blocks/notification/` + `fui:blocks/signature-pad/` (not in this changeset) — external, not this
  migration. The deprecated `target` alias (#1299) keeps any remaining external consumers green.
