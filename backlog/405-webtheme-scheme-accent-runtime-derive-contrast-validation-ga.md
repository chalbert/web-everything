---
kind: story
size: 5
parent: "364"
status: resolved
blockedBy: ["404"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-13"
graduatedTo: webtheme/schemes.ts
tags: []
---

# webtheme scheme + accent runtime (derive + contrast-validation gate, curated override)

Fork 4 of the #364 ruling (A'): the scheme + accent-derivation runtime. Derive light/dark/contrast schemes and accent/state scales natively (light-dark()/color-scheme/relative-color/color-mix), VALIDATED per step against WCAG/APCA so accessibility is by-default; expose a curated-scale override for brand precision. Patterns: MD3 HCT tonal palettes + Adobe Leonardo (contrast-first generation). Blocked on #404 (needs the primitive token tier the scales derive from).
