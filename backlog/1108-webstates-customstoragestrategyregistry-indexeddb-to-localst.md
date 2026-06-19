---
type: idea
workItem: story
size: 3
parent: "1089"
status: open
blockedBy: ["1106"]
dateOpened: "2026-06-19"
tags: []
---

# webstates: CustomStorageStrategyRegistry + IndexedDB to localStorage degradation

we:plugs/webstates/CustomStorageStrategyRegistry.ts extends HTMLRegistry, per-scope active(), built-in degradation chain per spec we:src/_includes/project-webstates.njk:312-327. Demo: IndexedDB-unavailable degrades to localStorage transparently.
