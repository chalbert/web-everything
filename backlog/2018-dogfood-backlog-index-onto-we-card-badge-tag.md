---
kind: story
size: 5
parent: "777"
status: resolved
blockedBy: ["2016"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: [dogfood, fui, ssr, backlog-page]
---

# Dogfood the backlog index onto we-card / we-badge / we-tag (SSR)

## Digest

`we:src/backlog.njk` (~732 lines) is the single biggest hand-rolled surface on the site: a raw HTML grid plus
inline JS filters (`we:src/backlog.njk:92-370`) with **zero `we-*` components** in the card bodies. The status
pills already use the badge/tag macros (`we:src/_includes/backlog-badges.njk`) and the prioritization section
already uses `we-filter-chip`, but the item cards themselves are hand-written `div`s. Convert the item grid to
SSR-rendered `we-card` tiles with `we-badge` status + `we-tag` kind/size/tier chips, using the build-time render
path from #2016.

## Scope

- Replace the hand-rolled item-card `div`s in `we:src/backlog.njk` with `we-card` tiles rendered via the #2016
  SSR shortcode; move status/kind/size/tier onto `we-badge` / `we-tag` (reuse `we:src/_includes/backlog-badges.njk`
  macros where they already exist).
- Preserve the existing filter behavior (`we:src/assets/js/backlog-burndown.js` / inline filters) — filters must
  still operate over the new component markup.
- Keep the hand-rolled baseline working with JS off (SSR output correct pre-upgrade).

## Acceptance

- `/backlog/` renders item tiles as SSR `we-card` with badge/tag children; correct with JS disabled.
- Filters (status/kind/size/tier) still work; Playwright before/after on the running dev server, 0 console errors,
  no visual regression to the grid.
- No remaining hand-rolled item-card `div`s in `we:src/backlog.njk`.

## Notes

- Depends on #2016 (SSR render path). Table-shaped sub-surfaces that would need `we-data-table` are **excluded**
  until #1964 (wrap vs render-from-data) is settled — this item is card/badge/tag only.

## Resolution (2026-07-02)

- The tracked-work tile grid (`we:src/backlog.njk`) is now SSR'd from `we-card` at build time via a new
  `weBacklogGrid` filter (`we:.eleventy.js` → `we:scripts/lib/component-render-build-hook.cjs` `renderBacklogGrid`),
  the #2016 render-from-data path generalized to the biggest hand-rolled surface on the site. Each item renders
  as a real `<article class="fui-card">` (`#num Title` → card title); the badge/tag/blocker/summary/children/meta
  body is still composed by the SHARED `we:src/_includes/backlog-badges.njk` macros (the anti-drift source of
  truth) and **sentinel-spliced** into the SSR card verbatim — NOT fed through the harness `innerHTML` round-trip,
  which would decode the template's entity-escaping and leak a raw `<template>` (an item summary carries one) that
  swallows the rest of the grid. The outer `.project-card` chrome (the `data-status/kind/size/tier` filter facets
  + the `.project-card-link` overlay) is kept, so the existing filters/search (`we:src/assets/js/home-display.js`)
  work unchanged; a `.project-title` alias on the SSR title keeps the search hook.
- Surfaced + fixed an SSR **card-title escaping defect** in FUI's build harness
  (`frontierui:blocks/renderers/component-render/buildHarness.ts`): a title carrying literal markup (e.g.
  `Deferred <component> opt-ins`) leaked a raw tag because happy-dom's `.outerHTML` doesn't re-encode a
  `textContent`-set title. The title now serializes as a pre-escaped Text node. (Fixes the intent/project/stage
  grids too.)
- Verified: 2124 SSR tiles correct with JS disabled (0 raw-tag leak, view-source-visible), filters hide
  (212→40 on status toggle) and search narrows (212→16), 0 console errors from the grid markup.
