---
kind: story
size: 5
parent: "866"
status: open
blockedBy: ["1598"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs catalog tiles/cards to FUI blocks/card (mode-C mount)

Migrate the catalog tile/card surfaces (~20 pages: we:src/intents.njk, we:src/blocks.njk, we:src/design-systems.njk, the we:src/_includes/project-* includes) to FUI blocks/card via the mode-C inline mount proven by #1598. Reuses the established transform. Gate npm run verify + a :8080 render check. May need a 2nd-level /slice by include-family if it stays >3.
