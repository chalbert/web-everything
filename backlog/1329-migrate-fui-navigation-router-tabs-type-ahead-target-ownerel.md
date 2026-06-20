---
kind: task
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1299"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/navigation/"
tags: []
---

# Migrate fui:navigation/router/tabs/type-ahead target → ownerElement

Flip this.target → this.ownerElement across fui:blocks/navigation, fui:blocks/router, fui:blocks/tabs, fui:blocks/type-ahead (7 CustomAttribute subclasses) + tests, after #1299's alias lands. Part of the #1299 webbehaviors carve.

## Progress

- Flipped `this.target` → `this.ownerElement` (50 occurrences) across the 7 CustomAttribute subclasses:
  `fui:blocks/navigation/NavMenubarBehavior.ts`, `fui:blocks/navigation/NavSectionBehavior.ts`,
  `fui:blocks/navigation/NavListBehavior.ts`, `fui:blocks/tabs/TabGroupBehavior.ts`,
  `fui:blocks/router/behaviors/RouteLinkBehavior.ts`, `fui:blocks/router/behaviors/RoutePrefetchBehavior.ts`,
  `fui:blocks/type-ahead/TypeAheadBehavior.ts`. `e.target`/`e.currentTarget` (TabGroupBehavior) left
  untouched (literal `this.target` only).
- No dedicated test files for these families reference `.target`; ran the **full** FUI suite as
  confirmation — 2425 passed / 9 skipped / 0 failed.
