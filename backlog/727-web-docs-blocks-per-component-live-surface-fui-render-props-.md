---
type: idea
workItem: story
size: 8
parent: "623"
status: open
dateOpened: "2026-06-15"
tags: []
---

# Web Docs /blocks/ — per-component live surface (FUI render + props/token/a11y panels) on the catalog skeleton

The full per-component half of the Web Docs catalog, on top of the shipped /blocks/ index skeleton (#627, src/blocks.njk). Each block's /blocks/{id}/ page gains a live example (real FUI block render via #604's pipeline + the #701 fuiDemo iframe embed, NOT static specs), a props table (from the #626 CEM derivation), a token table, and an a11y panel — the Storybook-equivalent per-component view. Carved from #627 at batch-2026-06-15 once its quick-win index slice shipped.

## Traced the data sources — false premise on the props table; needs /slice + a build (2026-06-16, batch-2026-06-16)

Claimed in a batch and traced the four panels' data sources against the real tree before building. #604 / #701 / #626 are all **resolved** now (the old `blockedBy: 604` + "held, D3-readiness" copy was stale — removed). But the panels split into *available* and *blocked-in-fact*:

- **Live example — available now.** The #701 `fuiDemo` shortcode exists (`.eleventy.js:38`) and is already used in the per-block `src/_includes/block-descriptions/{id}.njk` includes that `src/block-pages.njk` renders. A uniform live-example slot is a small, real slice.
- **Props table — blocked-in-fact (false premise).** *"props table from the #626 CEM derivation"* doesn't hold: `custom-elements.json` (68 modules) carries **zero** `members` / `attributes` / `customElement` declarations — every declaration is a plain `class` whose only payload is an `x-webeverything` block (`implementsIntent` + `traits[]`). There is **no prop/attribute data to tabulate.** A real props table needs a richer CEM **generation** step (a CE-manifest analyzer that emits members/attributes) that does not exist — a separate build/decision, not part of this item.
- **Token table + a11y panel — unverified sources.** Neither has a confirmed on-disk data source either; both need the same "where does this data come from" answer the props table exposed.

Note the inversion: the CEM data that **does** exist (`x-webeverything` intent + traits) is exactly the **anatomy/composition** data #748 wants — not props. So #748's static anatomy is buildable off this CEM; #727's props table is not.

**Action:** released unworked. Needs a `/slice`: (a) the live-example slot (ready now), (b) a **decision/build** to make the CEM emit element members/attributes before any props table, (c) token + a11y data sourcing. Don't batch the whole item until (b) lands.
