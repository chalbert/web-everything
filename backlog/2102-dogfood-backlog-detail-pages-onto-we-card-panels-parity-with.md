---
kind: story
size: 2
parent: "2021"
status: open
blockedBy: ["2098", "2018"]
dateOpened: "2026-07-02"
tags: []
---

# Dogfood backlog detail pages onto we-card (panels; parity with the converted tile)

Convert the 4 section-card fui-card panels of we:src/backlog-pages.njk (body, Contains, Blocked by, References) to SSR we-card via the #2098 primitive. Header badges keep the shared we:src/_includes/backlog-badges.njk macros exactly as #2018 converts them (ONE source with the tile — the tile-subset-of-detail parity rule, we:src/backlog-pages.njk:143-155). Rides behind #2018 (active, uncommitted working-tree edits on this file). JS-off correct; Playwright before/after.
