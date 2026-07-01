---
kind: task
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# plateau-app dev-server boot crash: WE credibilityWeighting _data module has no ESM default (dev surface #1984 missed)

In dev (Vite :4000) plateau-app crashed on boot: the weight-tuning panel (`plateau-app:src/weight-tuning/data.ts`, #1626) named-imported the WE-owned CommonJS `_data` module `we:src/_data/credibilityWeighting.js`. Vite's dev server wraps a CJS module via esbuild's cjs→esm interop, which exposes ONLY a synthetic `default` (= `module.exports`); the named exports are not synthesized, so `import { sourceKindDefault } from …` failed at boot ("does not provide an export named …"), taking every page down. #1626 (not #1984) introduced this import; it was verified only against the prod Rollup build, which DOES synthesize named CJS exports, and missed the dev-server surface.

**Fix (consumer-side interop — the WE module stays CJS):** the WE module must remain CommonJS — 11ty's `_data` layer requires it, like all 37 `we:src/_data/*.js` (there is no `type:module`), so an ESM surface was the wrong fix (it would break the 11ty build). Instead plateau-app now default-imports the whole module object and destructures its runtime members — the only surface reliable across BOTH the dev-server esbuild interop and the prod Rollup build. Changed in plateau-app: `plateau-app:src/weight-tuning/data.ts`, `plateau-app:src/weight-tuning/data.test.ts` (default-import + destructure), and `plateau-app:src/weight-tuning/credibilityWeighting.d.ts` (declares the `default` module object). No WE code changed. Verified: the `plateau-app:src/weight-tuning/data.test.ts` suite passes (9/9) through the same interop transform, and tsc is clean on the affected files.
