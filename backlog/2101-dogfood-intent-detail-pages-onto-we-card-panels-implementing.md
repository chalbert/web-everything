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

# Dogfood intent detail pages onto we-card (panels + implementing-blocks grid)

Convert we:src/intent-pages.njk: the 6 section-card panels to SSR we-card via the #2098 primitive, and the hand-rolled standard-card implementing-blocks grid (we:src/intent-pages.njk:72-87) to we-card tiles following the intentTileSpecs shape (we:scripts/lib/component-render-build-hook.cjs:132-145). Dimension/research tables stay plain per #1964. JS-off correct; Playwright before/after.
