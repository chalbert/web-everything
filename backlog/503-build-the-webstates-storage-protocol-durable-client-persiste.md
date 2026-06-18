---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["011"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "protocol:storage"
tags: []
---

# Build the webstates storage protocol (durable client persistence facet)

Ratified successor to #011 (gap #4, Option A): build the thin storage Protocol as a persistence facet of webstates — a CustomStorageStrategy registry tried per-scope, IndexedDB as the native-first default, localStorage as graceful degradation, plus navigator.storage.persist()/quota. Mirrors the change-tracking protocol's CustomStrategy shape (we:protocols.json). Scope is the durable structured-record store only; the response-cache (webresources), outbox/replay (webreliability), and conflict-merge (change-tracking) facets are tracked under their own owners. No webpersistence project is minted — this protocol can later graduate into one if a real cross-cutting sync-orchestration consumer appears.

## Progress

Delivered (2026-06-13), gate green — ratified from #011 (gap #4, Option A: no webpersistence project):
- `storage` protocol entry in [we:protocols.json](../src/_data/protocols.json) (`ownedByProject: webstates`, `anchor: protocol-storage`).
- New `#protocol-storage` section in [we:project-webstates.njk](../src/_includes/project-webstates.njk): `CustomStorageStrategy` contract (async get/set/delete/keys + optional bulk/subscribe), `StoragePersistence` (`persist`/`persisted`/`estimate`), per-scope selection with IndexedDB→localStorage degradation, and the scope-boundary table (response-cache→webresources, outbox→webreliability, conflict→change-tracking).

Mirrors the change-tracking `CustomChangeStrategy` shape. Scope = durable structured-record store only; no project minted. `check:standards` green (27 protocols), 11ty dry-run clean.
