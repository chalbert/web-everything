---
kind: story
size: 5
parent: "777"
status: open
blockedBy: ["2016"]
dateOpened: "2026-07-01"
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
