---
kind: task
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
dateResolved: "2026-07-01"
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

## Progress

- **2026-06-30 (batch-2026-06-29e `/workflow`):** the import repoint is **done and landed on `plateau-app:origin/main`**
  (`328d73b` — `plateau-app:src/main.ts:15` now reads `import SimpleStore from '@frontierui/blocks/stores/simple/SimpleStore'`);
  the original `SimpleStore` ENOENT is gone. But `npm run build` is **still red** for a *second, independent* reason —
  `plateau-app:src/weight-tuning/data.ts` named-imports a CommonJS WE `_data` module (filed as **#1984**), so the
  orchestrator's WE-last gate correctly held back this item's `active→resolved` flip (no false "resolved"). Now
  `blockedBy: 1984`; once #1984 lands, build-green is a trivial confirm-and-resolve. Item stays **active** (recoverable
  cross-repo partial).
- **2026-07-01 (batch-2026-07-01 `/workflow`):** blocker **#1984 is resolved** (its #2033 fix — default-import +
  destructure of the CJS `we:src/_data/credibilityWeighting.js` — landed on `plateau-app:origin/main`). Both prior
  reds are now gone: `plateau-app:src/main.ts:15` reads `import SimpleStore from '@frontierui/blocks/stores/simple/SimpleStore'`
  and `plateau-app:src/weight-tuning/data.ts` uses the default-import/destructure shape. Confirmed `npm run build`
  in plateau-app goes **green** (508 modules transformed, exit 0). `blockedBy` cleared; resolving.
