---
kind: story
size: 3
status: resolved
blockedBy: ["609"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "intent:hover-intent (intents.json) + plateau-app hover-intent Configurator domain (seed-hover-intent.ts)"
tags: []
---

# Mint the hover-intent standalone concern (trigger-transition) + its Technical Configurator card

Ratified by #609 Fork 2A: hover-intent (open/close-delay + safe-area corridor tolerating diagonal trigger→panel travel) is a standalone reusable concern, NOT a dimension on the anchor intent — it's a trigger-transition behavior orthogonal to anchor's placement/dismissal contract, composed by reveal-nav, menu submenus, and hovercards. Mint it as a small intent in we:intents.json (intent-UX-only: "tolerate diagonal travel; don't open on incidental pass-through"). The unsettled mechanic (delay-only vs CSS safe-area bridge vs JS pointer-direction polygon) is NOT part of the intent — author it as a Technical Configurator card (delay ms / close-delay / safe-area strategy / touch) in plateau-app per intent-UX-only→configurator.

## Progress

Two artifacts, two repos (intent → WE, mechanic → Plateau), per intent-UX-only→configurator:

- **WE intent** `hover-intent` in [we:src/_data/intents.json](/src/_data/intents.json) (status `draft`) — **UX-only**: 3 dimensions (`openIntent` deliberate|eager, `travelForgiveness` forgiving|strict, `touch` tap-toggle|none, most-permissive defaults) describing "tolerate diagonal travel; don't open on incidental pass-through." Explicitly orthogonal to the `anchor` intent; the *how* is deferred to the Configurator. Renders at /intents/hover-intent/.
- **plateau-app Configurator domain** `hover-intent` (`plateau:src/technical-configurator/seed-hover-intent.ts` + provider + 3 presets) — the **technical mechanic**: 3 outcome axes (corridor timed-grace|geometric, dependency css-only|needs-js, accuracy approximate|pointer-accurate) and the 3 strategies **delay-only** / **css-safe-area** / **js-pointer-polygon**. Grounded in the #610 reveal-nav sweep.
- Gate: `check:standards` 0 errors + /intents/hover-intent/ renders · plateau-app `npm test` 131/131, type-clean. Intent → webeverything; configurator → plateau-app.
