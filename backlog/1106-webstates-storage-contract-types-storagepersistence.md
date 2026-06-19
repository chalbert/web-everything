---
type: idea
workItem: story
size: 2
parent: "1089"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webstates/CustomStorageStrategy.ts"
tags: []
---

# webstates: Storage contract types + StoragePersistence

we:plugs/webstates/CustomStorageStrategy.ts per spec we:src/_includes/project-webstates.njk:286-304 (async get/set/delete/keys + StoragePersistence over navigator.storage) + native IndexedDB and localStorage strategies; export from index. Demo: round-trip unit test per strategy.

## Progress

Shipped `we:plugs/webstates/CustomStorageStrategy.ts` — the durable-storage contract + native strategies
(spec `we:src/_includes/project-webstates.njk`, #503 ruling): `CustomStorageStrategy<T>` (async
get/set/delete/keys + optional bulk/subscribe), `StoragePersistence` (persist/persisted/estimate over
`navigator.storage`), `StorageBulkOp`. Native-first strategies: `IndexedDBStrategy` (`native-indexeddb`,
one object store per scope) + `LocalStorageStrategy` (`local-storage`, the degradation floor) +
`pickStorageStrategy()` feature-detect + `nativeStoragePersistence`. Exported from
`we:plugs/webstates/index.ts`. Tests (`we:plugs/webstates/__tests__/unit/CustomStorageStrategy.test.ts`, 6 green + 1 gated):
localStorage round-trips fully (set/get/keys/delete/bulk/namespacing); the IndexedDB round-trip is
**feature-gated to a browser** (`it.skipIf(typeof indexedDB === 'undefined')`) because happy-dom does
not implement IndexedDB — real browser-correct code, exercised where the API exists (or under
fake-indexeddb), not silently skipped.
