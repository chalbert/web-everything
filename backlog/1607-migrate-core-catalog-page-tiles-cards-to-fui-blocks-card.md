---
kind: story
size: 3
parent: "1601"
status: open
blockedBy: ["1786"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate core catalog-page tiles/cards to FUI blocks/card

Migrate the catalog tile/card surfaces on the core catalog pages (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + sibling top-level catalogs) to FUI blocks/card via the **transient-CE mount** (`<we-card>`, #1621 rule-7 model — the card counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1786 (the FUI `fui:embed/card-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.
