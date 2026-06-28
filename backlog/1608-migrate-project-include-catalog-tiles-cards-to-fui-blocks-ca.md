---
kind: story
size: 3
parent: "1601"
status: open
blockedBy: ["1903"]
dateOpened: "2026-06-22"
tags: []
---

# Migrate project-* include card surfaces to product components (standard-card / standard-section)

Author the **product-substrate components** for the WE website and migrate the `we:src/_includes/project-*.njk`
card surfaces onto them, per the #1886 substrate boundary (resolved 2026-06-28 —
`we:docs/agent/platform-decisions.md#identity-semantic-look-composable`). **The original "swap to `<we-card>`"
framing is superseded:** a card surface is delivered as a **product component that composes the FUI
primitive**, not a hand-applied `<we-card>`/class.

- **the 22 `<div class="standard-card">` content cards → `<standard-card>`** (product component composing the
  FUI `we-card` primitive → `<article class="fui-card">`);
- **the 279 `.section-card` `<section>` wrappers → `<standard-section>`** (product component composing the FUI
  `we-section-card` primitive **#1903** → `<section class="fui-card">`), keeping the `<section>` landmark +
  wrapper `id` + each `<hN id>` heading verbatim (so `#anchor` TOC links + `.section-card:target` survive);
- **the 7 `<a class="standard-card">` link tiles stay `<a>`** on the #1820 catalog-tile pattern.

`standard-card` / `standard-section` live in the **WE website's own frontend, not WE/FUI**, namespace via the
config knob (default empty → unprefixed). Heading/title is owned by the product component (composes the
`<hN id>` it needs) — there is no `we-card`-level heading decision. Gate `npm run verify` + a `:8080` render
check (landmarks, deep-link `:target`, and the ~17 `#…` heading anchors all intact).

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
