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

# webtheme: accent + scheme CSS golden/snapshot regression test

Replace the 4 toContain checks (we:webtheme/__tests__/schemes.test.ts:143-149) with a full-output snapshot/golden of compileSchemeCss(deriveSchemeRuntime(defaultTokens)) — :root color-scheme + --color-bg/-fg + every --color-accent-N in ramp order + the HC block (we:webtheme/schemes.ts:350-375,282-294); pin at least accent-9's derived value. Demo: a one-line emit change breaks the snapshot loudly.

## Progress

Added an `emitted-CSS golden` describe block to we:webtheme/__tests__/schemes.test.ts (kept the existing `toContain` smoke checks): (1) a `toMatchInlineSnapshot` of the entire `compileSchemeCss(deriveSchemeRuntime(defaultTokens))` output — `:root` color-scheme + `--color-bg/-fg` + all six `--color-accent-N` in ramp order + the full `@media (prefers-contrast: more)` block, byte-for-byte; (2) pins the derived `accent-9` literal — the `oklch(from var(--color-accent) 0.55 c h)` expression plus its computed sRGB `{r,g,b}` snapshot so `recolorLightness()` can't drift unnoticed. Any emit change now breaks the snapshot loudly. `npx vitest run webtheme` green (36 tests).
