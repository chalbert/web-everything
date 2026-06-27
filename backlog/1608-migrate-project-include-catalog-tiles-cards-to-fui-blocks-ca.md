---
kind: story
size: 3
parent: "1601"
status: open
blockedBy: ["1820"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate project-* include catalog tiles/cards to FUI blocks/card

Migrate the catalog tile/card surfaces in the `we:src/_includes/project-*.njk` includes to FUI blocks/card via the **transient-CE mount** (`<we-card>`, #1621 rule-7 model — the card counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1786 (the FUI `fui:embed/card-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

## Pre-flight (batch-2026-06-27) — fork resolved; now a clean mechanical migration

The catalog-tile→`we-card` vocabulary-mapping fork is **decided**: #1820 resolved (Fork 1a) — the
anchor-relocation rule + the vocabulary map are settled there, the in-page filter JS stays attribute-driven
off the preserved `data-*` hooks (no "read off a card model" rework), and the mount is the already-ratified
#1621 rule-7 transient-CE model. So this is now the uniform badge+tag migration #1820 widened it to, not a
design call. (Supersedes the prior "undecided mapping" note — that blocker cleared when #1820 resolved.)
