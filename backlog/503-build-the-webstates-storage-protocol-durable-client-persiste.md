---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["011"]
dateOpened: "2026-06-13"
tags: []
---

# Build the webstates storage protocol (durable client persistence facet)

Ratified successor to #011 (gap #4, Option A): build the thin storage Protocol as a persistence facet of webstates — a CustomStorageStrategy registry tried per-scope, IndexedDB as the native-first default, localStorage as graceful degradation, plus navigator.storage.persist()/quota. Mirrors the change-tracking protocol's CustomStrategy shape (protocols.json). Scope is the durable structured-record store only; the response-cache (webresources), outbox/replay (webreliability), and conflict-merge (change-tracking) facets are tracked under their own owners. No webpersistence project is minted — this protocol can later graduate into one if a real cross-cutting sync-orchestration consumer appears.
