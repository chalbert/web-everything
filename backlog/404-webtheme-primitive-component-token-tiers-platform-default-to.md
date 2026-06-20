---
kind: story
size: 5
parent: "364"
status: resolved
blockedBy: ["403"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webtheme/tokens.ts
tags: []
---

# webtheme primitive + component token tiers + platform default token set

Fork 3 of the #364 ruling: author the primitive tier (raw spacing/radius/elevation/type-ramp/color scales) and the component tier (per-component overrides) of webtheme, plus the complete platform default token set projects extend via 'extends'. The semantic tier stays the existing intents (surface/density/typography/motion/theme-color) — tokens supply the concrete values those intents resolve into; no parallel semantic vocabulary. Blocked on #403 (project + DTCG-CSS mapping must exist first).

**Graduated to** `webtheme/` — we:tokens.ts + we:compile.ts + we:defaultTokens.ts.
