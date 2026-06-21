---
kind: story
size: 3
parent: "1210"
status: resolved
locus: plateau-app
blockedBy: ["1236"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "plateau:src/marketing/deck-strategic.ts"
tags: []
---

# Strategic/vision pitch deck — render the #1212 outline on the plateau deck shell

Synthesize we:reports/2026-06-20-deck-strategic-vision-outline.md into [data-slide] markup on the #1236 plateau deck shell (DeckBehavior mount + webtheme theming), replacing the placeholder, and add its /deck strategic route in plateau:src/main.ts. The investor/partner/self-alignment deck; first audience deck, parallel with #1359/#1360 once #1236 lands the shell.

## Progress (batch-2026-06-21)

- Pre-flight state-fix: set `locus: plateau-app` (was unset → defaulted to we).
- Built `plateau:src/marketing/deck-strategic.ts` — the #1212 outline as 10 `[data-slide]` sections (cold
  open → the hole → reframe/moat → layered surface → constellation → open-core → working-corpus →
  self-applied proof → polyglot reach → partner/fund/align ask) via the #1359 `mountDeckWithSlides` seam.
- The flagship deck **replaces the #1236 placeholder** as the default `/deck` content: `tryMountDeck` now
  calls `mountStrategicDeck` (the placeholder `mountDeck` stays in `plateau:src/marketing/deck.ts` as the
  shell self-demo reference). Completes the audience-deck trio (strategic /deck · developer /deck/developer
  · design-system /deck/design-system).
- Verified live on :4000 (Playwright): `/deck` renders 10 strategic slides, DeckBehavior mounts 1 visible,
  first heading "Three repos, one bet", no console errors. Plateau gate `npm test` → 259/259 pass.
