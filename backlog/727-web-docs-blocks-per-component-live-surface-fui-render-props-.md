---
type: idea
workItem: story
size: 3
parent: "623"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Web Docs /blocks/ — uniform live-example slot on every per-component page

Add a structured live-example `section-card` to every `/blocks/{id}/` page that embeds the block's
Frontier-UI-hosted demo via the `fuiDemo` shortcode, driven by an optional `fuiDemo` field on the block's
`blocks.json` entry. Today the demo is embedded **ad-hoc** in 8 of 69 per-block includes; this makes it a
uniform, data-driven slot on the catalog skeleton (#627). The core, buildable-now slice of the
per-component live surface — the props/token/a11y panels each split off to their own data-sourcing
decisions (below), since the body's original "props table from the #626 CEM derivation" premise was
traced false.

## Build

- **Slot in the template.** Add a `section-card` to [`src/block-pages.njk`](../src/block-pages.njk) (it
  currently includes `block-descriptions/{id}.njk` at `:32-35` with no structured demo slot) that renders
  `{% fuiDemo block.fuiDemo.file, block.fuiDemo.title, block.fuiDemo.height %}` when the block carries a
  `fuiDemo` field.
- **Data field.** Add an optional `fuiDemo: { file, title, height }` to the relevant entries in
  [`src/_data/blocks.json`](../src/_data/blocks.json) (start with the 8 that already have demos).
- **De-dupe.** Migrate the 8 ad-hoc `{% fuiDemo … %}` calls out of the `block-descriptions/*.njk`
  includes (`tabs`, `tooltip`, `nav-list`, `autocomplete`, `for-each`, `view`, `component`,
  `interpolation-text-node`) into the structured slot so there's one home.
- The `fuiDemo` shortcode itself already exists ([`.eleventy.js:38`](../.eleventy.js), #701) — no
  cross-repo import, the demo stays an FUI deliverable behind a sandboxed iframe.

## Acceptance

- Every `/blocks/{id}/` page with a `fuiDemo` field renders the live example in a uniform slot; pages
  without one render no empty slot.
- The 8 previously-ad-hoc demos render through the structured slot (no duplicate embeds).
- `npm run check:standards` green; the per-block pages build.

## The other three panels are not part of this slice — each carved to a decision

Traced against the real tree (2026-06-16, `/split 727`,
`reports/2026-06-16-backlog-split-analysis.md`), the props/token/a11y panels each bury a distinct
"what data, from where" call rather than buildable volume, so each is its own `type:decision`:

- **Props table → [#801](/backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table/).**
  The body's "needs a CE-manifest analyzer that does not exist" is stale — the CEM protocol + emit
  pipeline ([#653](/backlog/653-register-custom-elements-manifest-cem-as-a-we-protocol-emit-/),
  `scripts/gen-cem.mjs`) and the props-table renderer
  ([#654](/backlog/654-mint-the-props-table-block-render-custom-elements-manifest-a/),
  `block-descriptions/props-table.njk`) both shipped. What's missing is *where* the structured
  per-component API data originates (WE-authored vs an FUI-side analyzer — a WE/FUI boundary call);
  `custom-elements.json` carries 0 members/attributes today.
- **Token table → [#802](/backlog/802-per-component-token-table-data-sourcing-for-the-web-docs-blo/).**
  A per-component token tier exists (`webtheme/defaultTokens.ts:90-104`, button/card) but covers ~2 of 69,
  is keyed by component name not `block.id`, and `webtheme/` isn't exposed to 11ty — the data wiring +
  mapping + scope is undecided.
- **A11y panel → [#803](/backlog/803-per-component-a11y-panel-content-data-sourcing-for-the-web-d/).**
  No per-component a11y source exists at all (#770 is a route-level axe gate, not per-component metadata);
  even what the panel shows is unspecified.

Each decision, on ratification, spins out its own panel-integration build slice.

## Progress (resolved 2026-06-16)
- Added the uniform **Live example** `section-card` to [`src/block-pages.njk`](../src/block-pages.njk) — renders `{% fuiDemo block.fuiDemo.file, block.fuiDemo.title, block.fuiDemo.height %}` only when the block carries a `fuiDemo` field (no empty slot otherwise).
- Added optional `fuiDemo: { file, title, height }` to the 8 entries in [`src/_data/blocks.json`](../src/_data/blocks.json) that already had demos (`tooltip`, `nav-list`, `tabs`, `autocomplete`, `for-each`, `interpolation-text-node`, `component`, `view`) — surgical splice, JSON re-validated.
- De-duped: removed the ad-hoc `{% fuiDemo … %}` calls (+ their now-redundant "Try it live" stanzas) from all 8 `block-descriptions/*.njk` includes — one home for the embed.
- Verified: 11ty dryrun builds clean; rendered `/blocks/tooltip/` shows the **Live example** slot + `fui-demo-frame` and no stray "Try it live"; `check:standards` green.
