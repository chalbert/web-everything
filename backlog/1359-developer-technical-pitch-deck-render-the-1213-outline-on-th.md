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
graduatedTo: "plateau:src/marketing/deck-developer.ts"
tags: []
---

# Developer/technical pitch deck — render the #1213 outline on the plateau deck shell

Synthesize we:reports/2026-06-20-deck-developer-technical-outline.md into [data-slide] markup on the #1236 plateau deck shell (DeckBehavior mount + webtheme theming) and add its route in plateau:src/main.ts. Second audience deck; independent of the design-system deck once #1236 lands the shell.

## Progress (batch-2026-06-21)

- Pre-flight state-fix: set `locus: plateau-app` (was unset → defaulted to we; the work is entirely in
  plateau-app, gated by `npm test`, committed to plateau-app).
- Refactored the #1236 shell `plateau:src/marketing/deck.ts` to export `mountDeckWithSlides(mount,
  slidesHtml)` (the audience-content seam the shell was built for); `mountDeck` now delegates with a
  named `PLACEHOLDER_SLIDES`. No behaviour change — base `/deck` still renders its 2 placeholder slides.
- Built `plateau:src/marketing/deck-developer.ts` — the #1213 outline as 10 `[data-slide]` sections
  (problem → reframe → 5 layers one-per-slide → native-first → conformance → polyglot/ask), mounted on
  the shared shell via `mountDeckWithSlides`.
- Route `/deck/developer`: `plateau:index.html` template + mount div, `plateau:src/main.ts` import,
  PUBLIC_ROUTES entry, route-change dispatch, AND the bootstrap deep-link mount (`tryMountDeveloperDeck()`
  alongside `tryMountDeck()` — direct deep-links don't fire route-change).
- Verified on the live :4000 server (Playwright): `/deck/developer` renders 10 slides, DeckBehavior mounts
  with exactly 1 visible, first heading correct, no console errors. Deck nav parity with #1236 confirmed
  (base `/deck` and the dev deck behave identically — the refactor reused the exact wiring). Plateau gate
  `npm test` → 259/259 pass.
