---
type: idea
workItem: story
size: 5
parent: "777"
status: open
blockedBy: ["871"]
dateOpened: "2026-06-17"
tags: []
---

# WE-docs theme + intents bundle for dogfooded FUI chrome

Adopt a FUI theme + intents bundle (#747, resolved) so the FUI components mounted into WE-docs chrome carry WE-docs branding. Gate cleared: #765 (relax) and #747 both resolved. First migration slice of the dogfood rework.

## Re-blocked 2026-06-17 (batch-2026-06-17 pre-flight) — blocked-in-fact on the design-system bundle infrastructure

Claimed in a batch; "adopt a FUI theme + intents bundle" has **nothing to adopt into**. #747 *ruled* the bundle shape (a `designSystems.json` manifest `{ extends, themeTokens, intentDefaults?, traitDefaults? }` + a `/design-systems/` catalog + validator, Fork-3-A) but that infrastructure was **never built** — verified absent: no `src/_data/designSystems.json`, no `src/design-systems.njk`, no `validateDesignSystem` in `check-standards-rules.mjs` (only `webtheme/tokens.ts` primitives exist). There is no registry to author a WE-docs bundle into.

Filed the missing #747-Fork-3-A build as **#871** (the `designSystems.json` registry + `/design-systems/` catalog + validator; parent #746) and set this item `blockedBy: ["871"]`. Secondary: this card's *stated purpose* ("so the FUI components mounted into WE-docs chrome carry branding") is also downstream of the chrome mount, which is itself blocked on #870 (the must-build FUI chrome blocks) via #865 — so even once #871 lands, the dogfood *application* needs #865/#870. Released to `open`; cascade-frees once #871 ships the registry.
