---
kind: story
size: 2
parent: "2021"
status: active
blockedBy: ["2098"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: []
---

# Dogfood research/demos content pages onto we-card

Convert the content-page card surfaces: the three hand-rolled project-card tiles in we:src/research.njk (we:src/research.njk:13,35,59 — design-references banner, topic grid, empty-state) and the standard-card demo grid + empty-state panel in we:src/demos.njk to SSR we-card tiles via the #2098 primitive (we:src/semantics.njk already converted as the #2098 proof-of-life). JS-off correct; Playwright before/after.
