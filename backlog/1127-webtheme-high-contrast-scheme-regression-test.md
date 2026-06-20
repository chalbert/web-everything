---
kind: task
parent: "1097"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:webtheme/__tests__/schemes.test.ts"
tags: []
---

# webtheme: high-contrast scheme regression test

Add assertions in we:webtheme/__tests__/schemes.test.ts beyond the single @media substring check (:148): assert highContrast.bg/.fg extremes (we:webtheme/schemes.ts:277-280), the @media (prefers-contrast:more) swap (:366-373), and that the HC pair clears the contrast policy (white-on-black 21:1). Demo: vitest run webtheme green with HC assertions.

## Progress

Added a `high-contrast scheme (prefers-contrast: more)` describe block (3 tests) to we:webtheme/__tests__/schemes.test.ts: (1) `highContrast.bg/.fg` are the `light-dark(#ffffff,#000000)`/`light-dark(#000000,#ffffff)` extremes; (2) `compileSchemeCss` emits those exact decls inside the `@media (prefers-contrast: more)` override; (3) both HC pairs clear the policy — `wcagContrast` ≈ 21:1 and `|apcaLc|` > 90 Lc. `npx vitest run webtheme` green (34 tests).
