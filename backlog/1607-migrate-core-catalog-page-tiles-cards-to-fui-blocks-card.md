---
kind: story
size: 3
parent: "1601"
status: resolved
blockedBy: ["1820"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# Migrate core catalog-page tiles/cards to FUI blocks/card

Migrate the catalog tile/card surfaces on the core catalog pages (`we:src/intents.njk`, `we:src/blocks.njk`, `we:src/design-systems.njk` + sibling top-level catalogs) to FUI blocks/card via the **transient-CE mount** (`<we-card>`, #1621 rule-7 model — the card counterpart to the #1598/#1758 badge dogfood, **not** the retired mode-C inline mount). Blocked by #1786 (the FUI `fui:embed/card-in-document.ts` embed entry + SSR baseline). Gate npm run verify + a :8080 render check.

## Pre-flight (batch-2026-06-27) — fork resolved; now a clean mechanical migration

The catalog-tile→`we-card` vocabulary-mapping fork is **decided**: #1820 resolved (Fork 1a) — the
anchor-relocation rule + the vocabulary map are settled there, the in-page filter JS stays attribute-driven
off the preserved `data-*` hooks (no "read off a card model" rework), and the mount is the already-ratified
#1621 rule-7 transient-CE model. So this is now the uniform badge+tag migration #1820 widened it to, not a
design call. (Supersedes the prior "undecided mapping" note — that blocker cleared when #1820 resolved.)

## Shipped (batch-2026-06-27-1842-1720)

Migrated the two anchor-tile catalogs #1820 Fork 1a explicitly ruled + verified — `we:src/intents.njk` and
`we:src/blocks.njk`:
- Each tile body wrapped in `<we-card>` (server-rendered, upgrades in place to `<article class="fui-card">`);
  the status pill → `<we-badge tone>` (status-enum mapped onto the closed 5-tone enum: active→success,
  draft→info, concept/experimental→warning, else→neutral), the dimension/type chips → `<we-tag shape="pill">`
  (the `implementsIntent` chip keeps its indigo via the `--cat-*` inline-palette pattern so the colour
  survives the transient upgrade).
- Click-through + filter `data-*` stay on the **outer `<a>`** (the card erases to a non-linkable `<article>`);
  the filter JS is untouched (it queries `.intent-tile`/`.block-card` + sets inline `display`, both preserved).
- Added a global frame-strip rule `we:src/css/style.css` `.project-card:has(> we-card)` so the anchor keeps
  grid layout + the hover lift but drops its own border/bg/shadow/padding — the card is the **sole** frame
  (no nested double box).

**Verified live on :8080** (Playwright): no double-frame (anchor border 0, card border 1px), the status
filter toggles tiles (97→62 on one status off), SSR baselines render. The transient-CE *upgrade* to
`.fui-card`/`.fui-badge`/`.fui-tag` didn't run only because the FUI cross-origin host (`frontierUrl`
`localhost:3001`) isn't running in this session — an environment condition affecting every transient-CE
element site-wide, not this change; progressive enhancement holds (the SSR baselines stand alone).

`npm run build:check` green (4353 files). **Scope narrowed** to the two ruled surfaces: `we:src/design-systems.njk`
is #1820 Fork 2 (its `<div>` tiles + status-meter, carved); the remaining sibling top-level catalogs
(adapters/plugs/protocols/states/resources/presets) follow the same pattern + the now-global CSS and are
carved to **#1870** (each needs its own status→tone map + chip-vocabulary check + render verify).
