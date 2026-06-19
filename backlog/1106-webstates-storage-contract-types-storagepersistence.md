---
type: idea
workItem: story
size: 2
parent: "1089"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webstates: Storage contract types + StoragePersistence

we:plugs/webstates/CustomStorageStrategy.ts per spec we:src/_includes/project-webstates.njk:286-304 (async get/set/delete/keys + StoragePersistence over navigator.storage) + native IndexedDB and localStorage strategies; export from index. Demo: round-trip unit test per strategy.
