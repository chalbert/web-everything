---
kind: task
parent: "1704"
status: open
dateOpened: "2026-06-23"
tags: []
---

# Mint the switcher layout-role intent

Author the project-less `switcher` intent (we:src/_data/intents/switcher.json) per #1680: composition-intent = flip horizontal<->vertical at a content-width threshold (no media breakpoint). Candidate role — distinct from stack/cluster (it auto-switches axis). FUI impl guidance: flex-wrap + min(). Renders at /intents/switcher/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.
