---
type: idea
workItem: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: webtheme semantic — scoped-token-override (per-slide/section design-tokens scoping)
relatedProject: webtheme
tags: [deck, theming, design-tokens, webtheme]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Scoped per-slide / per-section theming

Extend `design-tokens` scoping so a deck can override tokens (and background) **per slide or per section**, finer than the project/section grain. Homed in **webtheme**. *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Added semantic `scoped token override` (`we:src/_data/semantics/scoped-token-override.json`): extends `design-tokens` scoping to a per-slide / per-section grain (CSS custom-property cascade scope), so one deck carries distinct token sets + backgrounds without forking the theme. Binds to slide/section identity via the #1180 document model. Homed in webtheme; auto-renders in /semantics/.
