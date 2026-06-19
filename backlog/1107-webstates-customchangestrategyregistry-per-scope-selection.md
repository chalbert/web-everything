---
type: idea
workItem: story
size: 3
parent: "1089"
status: open
blockedBy: ["1105"]
dateOpened: "2026-06-19"
tags: []
---

# webstates: CustomChangeStrategyRegistry (per-scope selection)

we:plugs/webstates/CustomChangeStrategyRegistry.ts extends HTMLRegistry (mirror we:plugs/webstates/CustomStoreRegistry.ts) with an active() nearest-scope resolver + observe() helper per spec we:src/_includes/project-webstates.njk:180-195. Demo: two scoped registries resolve the nearest strategy.
