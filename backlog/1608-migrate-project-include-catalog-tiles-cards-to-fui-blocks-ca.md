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

## Pre-flight (batch-2026-06-26-1745-1775) — design fork, not a clean cascade

Surfaced while cascading the #1786 card embed: migrating the catalog tiles to `<we-card>` is **not** a
mechanical wrap (unlike the #1604/#1605/#1606 `<pre>`→`we-code-view` cascade). The catalog tiles (e.g.
`we:src/intents.njk:45`) are clickable `<a class="…-tile" data-status data-haystack>` whose `data-*` the
in-page filter JS depends on, carrying a bespoke per-status palette badge + dimension chips — none of which
map to `we-card`'s self-replacing `<article>` / `title`+body model without a design call (full adoption =
filter-JS rework + dropping the bespoke vocabulary; shallow wrap = a frame that keeps the bespoke vocab).
This is the **same vocabulary-mapping fork [#1208](/backlog/1208-dogfood-the-backlog-badges-chips-onto-fui-badge-filter-chip-/) is blocked on** (badge/chip flavour). Decide the catalog-tile→`we-card` mapping
first; then this becomes a clean migration. Left `open` (the #1786 blocker is resolved, but the real
blocker is the undecided mapping).
