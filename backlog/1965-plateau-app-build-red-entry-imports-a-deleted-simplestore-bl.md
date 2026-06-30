---
kind: task
status: active
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
tags: []
---

# plateau-app build red: entry imports a deleted SimpleStore block; repoint the WE import to frontierui after #1768

`plateau-app:src/main.ts:13` does `import SimpleStore from '@we/blocks/stores/simple/SimpleStore'`, but WE
**deleted** that block in `635d4cac` (#1768 — "delete the 6 graduated WE bootstrap-runtime block families");
SimpleStore now lives at `frontierui:blocks/stores/simple/SimpleStore.ts`. So `npm run build` in plateau-app
fails `[vite:load-fallback] Could not load …/blocks/stores/simple/SimpleStore (ENOENT)` — a **pre-existing**
red (present at `plateau-app:origin/main`, unrelated to any current batch). Repoint the import to the frontierui
home (`@frontierui/blocks/stores/simple/SimpleStore`, matching plateau's existing `@frontierui/*` alias) and
confirm `npm run build` goes green. Found by batch-2026-06-29d's `/workflow` integrator, whose unscoped
plateau-app build gate red-blocked the correct cross-repo work of #1947/#1909 (both `blockedBy` this).
