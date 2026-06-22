---
kind: story
size: 3
parent: "1601"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate core catalog-page tiles/cards to FUI blocks/card

Migrate the catalog tile/card surfaces on the core catalog pages (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + sibling top-level catalogs) to FUI blocks/card via the mode-C inline mount proven by #1598. Gate npm run verify + a :8080 render check.
