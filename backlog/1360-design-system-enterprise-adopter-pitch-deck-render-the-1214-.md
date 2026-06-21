---
kind: story
size: 3
parent: "1210"
status: resolved
locus: plateau-app
blockedBy: ["1236"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "plateau:src/marketing/deck-adopter.ts"
tags: []
---

# Design-system/enterprise-adopter pitch deck — render the #1214 outline on the plateau deck shell

Synthesize we:reports/2026-06-20-deck-design-system-adopter-outline.md into [data-slide] markup on the #1236 plateau deck shell (DeckBehavior mount + webtheme theming) and add its route in plateau:src/main.ts. Third audience deck; independent of the developer deck once #1236 lands the shell.

## Progress (batch-2026-06-21)

- Pre-flight state-fix: set `locus: plateau-app` (was unset → defaulted to we).
- Built `plateau:src/marketing/deck-adopter.ts` — the #1214 outline as 9 `[data-slide]` sections (hole +
  recurring tax → what-WE-is → working-corpus → dogfood → auditable conformance → reverse-adapter off-ramp
  → polyglot reach → migrate/pilot ask), mounted on the shared shell via the #1359 `mountDeckWithSlides` seam.
- Route `/deck/design-system`: `plateau:index.html` template + mount div, `plateau:src/main.ts` import,
  PUBLIC_ROUTES, route-change dispatch + bootstrap deep-link mount (`tryMountAdopterDeck`).
- Verified live on :4000 (Playwright): 9 slides render, DeckBehavior mounts 1 visible, first heading
  correct, no console errors. Plateau gate `npm test` → 259/259 pass.
