---
kind: task
status: resolved
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# plateau-app build red: weight-tuning data named-imports a CommonJS WE _data module (credibilityWeighting) — Rollup cannot resolve the named exports

plateau-app:src/weight-tuning/data.ts (the #1626 panel) does ESM named imports (sourceKindDefault, weightModifierDefault, weightFloorDefault, stalenessHorizonYearsDefault, computeCredibilityWeight, plus type CredibilityModifier/CredibilitySource) from we:src/_data/credibilityWeighting.js — but that module is CommonJS (module exports object), so the Vite/Rollup prod build fails: sourceKindDefault is not exported. A SECOND, independent plateau-app build red, distinct from the SimpleStore ENOENT that #1965 fixed and surfaced only once that first error cleared. No precedent for named-importing a WE CommonJS module: other plateau-app to WE _data imports use import-meta-glob on JSON. Fix options: default-import then destructure in we:src/_data, or give we:src/_data/credibilityWeighting.js a real ESM surface plus a co-located type-declaration. Verify the plateau-app build goes green. Blocks #1965 confirming build-green.
