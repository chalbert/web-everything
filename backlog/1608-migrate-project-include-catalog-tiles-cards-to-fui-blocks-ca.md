---
kind: story
size: 3
parent: "1601"
status: open
blockedBy: ["1871"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate project-* include catalog tiles/cards to FUI blocks/card

Migrate the catalog tile/card surfaces in the `we:src/_includes/project-*.njk` includes to FUI blocks/card via the **transient-CE mount** (`<we-card>`, #1621 rule-7 model — the card counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Gate npm run verify + a :8080 render check.

## Pre-flight (batch-2026-06-27-1842-1720) — premise is stale; re-pointed `blockedBy: ["1871"]`

Grounded the actual files while cascading from #1607. **The "catalog tile/card surfaces … uniform badge+tag
pass" premise is false here:** the `we:src/_includes/project-*.njk` includes have **zero** `.project-card`
anchor tiles and **no** status-pill / dimension-chip vocabulary (so #1820 Fork 1a's badge+tag mapping — which
#1607 applied to the intents/blocks anchor tiles — does **not** apply). What they actually carry is two
**content-card** surfaces: `.section-card` (~225 — `<section id=…>` content-section wrappers with deep-link
`:target` anchors + `h3`/`h4` headings) and `.standard-card` (~29 — `<div class="standard-card …"><h4 id=…>` +
prose content cards). Converting those to `<we-card>` is a different migration with a real semantics call
(the card erases `<section id>` → `<article class="fui-card">`, dropping the `id` that `#anchor` TOC links +
`.section-card:target` depend on; its `title` attr generates its own heading). That scope + semantics fork is
filed as **#1871** (`blockedBy` repointed `1820 → 1871`); this becomes a clean frame swap once it lands.
(Supersedes the earlier "now a clean mechanical migration" note — that was written before the files were read;
#1820 cleared the *catalog-tile* fork, but these includes have no catalog tiles.)
