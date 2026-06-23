---
kind: task
parent: "1704"
status: open
dateOpened: "2026-06-23"
tags: []
---

# Mint the sidebar (split) layout-role intent

Author the project-less `sidebar` intent (we:src/_data/intents/sidebar.json) per #1680: composition-intent = fixed + fluid columns that collapse when narrow. Identity = arrangement; FUI impl guidance: flex-basis + grow + wrap. The draggable boundary is the existing `resizable` intent (#1384); landmark navigation|complementary optional. Renders at /intents/sidebar/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.
