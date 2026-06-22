---
kind: story
size: 3
status: open
locus: webeverything
dateOpened: "2026-06-22"
tags: [bootstrap, cold-start, navigation, view-engine, migration-drift]
---

# Cold-start bootstrap break: NavSectionBehavior imports deleted ../view/ViewEngine (migrated to FUI) — 500s + aborts bootstrap, blanks all behavior demos

`we:blocks/navigation/NavSectionBehavior.ts:23` imports `../view/ViewEngine`, but `we:blocks/view/ViewEngine.ts` no longer exists (migrated to `fui:blocks/view/ViewEngine.ts`). On a fresh-process cold start Vite 500s that module (`Failed to resolve import "../view/ViewEngine"`); since `we:plugs/bootstrap.ts` → `registerNavigation` → `NavSectionBehavior`, the failed import aborts the whole bootstrap graph, so every interpolation/behavior demo renders empty on cold start (same #1503-class symptom; the warm singleton hides it). `we:blocks/__tests__/unit/view/ViewEngine.test.ts` is also dangling.

**Found 2026-06-22 in batch-2026-06-21-1501-1356 while verifying #1207** (the interpolation fix landed but its live render couldn't be confirmed because this 500 blanks the demo). **#1207 is `blockedBy` this.**

**Fix is a placement call (not a blind repoint):** WE blocks may NOT import `@frontierui/blocks` (the #701/#700 docs-rendering boundary), so the dangling import can't just be re-pointed at FUI. Either (a) NavSectionBehavior + NavListBehavior + the `we:blocks/view/ViewEngine` test belong in WE → the migration over-deleted `ViewEngine`; restore it (or its needed slice) to WE; or (b) the navigation behaviors are block impls that should move to FUI with ViewEngine (mirrors TabGroupBehavior, already in FUI using `../view/ViewEngine`). Decide the home, then land it so cold-start bootstrap is clean. Verify on a 2nd-port cold start (Playwright) that the behavior demos render.
