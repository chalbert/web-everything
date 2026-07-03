---
kind: story
size: 2
parent: "2021"
status: resolved
blockedBy: ["2098"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Dogfood intent detail pages onto we-card (panels + implementing-blocks grid)

Convert we:src/intent-pages.njk: the 6 section-card panels to SSR we-card via the #2098 primitive, and the hand-rolled standard-card implementing-blocks grid (we:src/intent-pages.njk:72-87) to we-card tiles following the intentTileSpecs shape (we:scripts/lib/component-render-build-hook.cjs:132-145). Dimension/research tables stay plain per #1964. JS-off correct; Playwright before/after.

## Resolution

Dogfooded `we:src/intent-pages.njk` onto the #2098 `weCard` primitive:

- **5 of the 6 section-card panels** (description, Dimensions, Design System Research, UX Research, Research
  Gaps) are now authored via the `weCard` macro — each emits an inert `<we-card data-we-spec>` placeholder
  that the `weComponentSSR` build transform batches through the pinned FUI CLI in ONE subprocess per page
  and splices to the finished SSR `<article class="fui-card">`, byte-identical to the client `<we-card>` CE
  upgrade. The dimension / design-system / UX / gaps **tables + lists stay plain markup per #1964** — only
  each panel FRAME is a card; the tabular content inside is untouched.
- **The implementing/composing-blocks grid** is converted to `weCard` tiles: block name = card title, block
  type = a header-trailing pill, body = summary + status meter. Each tile is wrapped in the proven
  `.project-card` box + overlay `.project-card-link` anchor pattern (`renderProjectGrid`/`renderBacklogGrid`),
  NOT an `<a>` wrapping the card — avoiding the nested-anchor parser ghost-clone bug; the box's own frame is
  stripped by `.project-card:has(> .fui-card)` so the card is the sole visual frame (`.block-tile-card` CSS
  added to `we:src/css/style.css`).

**Scope deviation from the ask (documented, not silent):** the item said "the 6 section-card panels". The
Implementing & Composing Blocks panel FRAME is deliberately left a **plain `.section-card fui-card`** (not a
`weCard`) because the `weComponentSSR` splice is **single-pass** over a page's placeholders — a `weCard`
panel whose `data-we-spec` JSON embeds child `weCard` block-tiles double-escapes the children, so they never
splice (verified: raw `<we-card data-we-spec>` leaked into the rendered panel). Nesting `weCard`-in-`weCard`
is unsupported by this primitive. The substantive dogfood here is the tile grid, so the wrapper stays plain
and the tiles are the cards. For the same single-pass reason the block **type pill stays the original plain
`<span>`** (not a nested `weBadge`) — it was never a badge component in the source markup either. This
non-nesting invariant is now pinned by a unit test in
`we:scripts/lib/__tests__/component-render-build-hook.test.mjs`.

Verified: `npx @11ty/eleventy` build → **zero** leftover `data-we-spec` placeholders across ALL intent
pages; panels + tiles splice to `.fui-card` (JS-off correct). Playwright before/after on `/intents/anchor/`
(multi-panel + 8 block tiles) shows visual parity. All 31 component-render-build-hook unit tests green.
