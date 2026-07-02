---
kind: story
size: 3
parent: "2021"
status: open
blockedBy: ["2098"]
dateOpened: "2026-07-02"
tags: []
---

# Dogfood block detail pages onto we-card (SSR panel chrome)

Convert the 10+ hand-rolled section-card fui-card panels across both tiers of we:src/block-pages.njk (e.g. we:src/block-pages.njk:49,55,64,84 — Overview, Live example, Quick start, API reference, Common patterns, WE Standards overlay, implementer panels) to SSR we-card via the #2098 primitive. data-table surfaces untouched: presentational doc tables are already in their ratified #1964 end-state (plain table.data-table). JS-off correct; Playwright before/after; 0 console errors.
