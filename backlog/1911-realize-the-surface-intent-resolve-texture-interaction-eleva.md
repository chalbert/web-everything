---
kind: story
size: 5
status: open
dateOpened: "2026-06-28"
tags: []
---

# Realize the surface intent — resolve texture/interaction (+ elevation/variant) to CSS and compose the hovercard from it

Per #1884's ruling (intent-owns-the-axis), realize the declared `surface` intent: resolve its `texture`/`interaction` dimensions — and realize `elevation`/`variant`, which its protocol declares but its `dimensions` block does not yet carry — to CSS via the trait resolver, then eliminate the raw-CSS blob in `we:src/_data/assemblerPresets/hovercard.json:70` by composing the surface properties from the declared `surface` intent (the preset already declares `composesIntents:[…surface]`). This is the ratified realize-a-declared-axis path and the actual fix for the card dogfood that spawned #1884.
