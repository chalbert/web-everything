---
type: decision
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, project, protocol, persistence, offline]
---

# Decide on Persistence/Offline project — `webpersistence` (gap #4)

Completes the data story: `webresources` fetches, `webstates` holds, nothing **persists**. Covers client storage abstraction, offline-first, optimistic sync, conflict resolution. Native anchors: Storage API, IndexedDB, Cache API, Background Sync, `navigator.storage.persist()`. Closes the offline loop the **reliability** research already opened and pairs with the CRDT/JSON-Patch work in the **change-tracking** topic under `webstates`.

## Triage context

- **Kind**: Project + Protocol
- **Native anchor**: Storage API, IndexedDB, Cache API, Background Sync
- **Native-first**: ◆ medium · **Gap**: ▲ high · **Effort**: ▲ high
- **Rank**: 4 — soon (the next full project after #3 Theme/Color intent)

## Open call

Confirm scope and shape (project + protocol) and timing — recommended as the next project after the Theme/Color intent lands.
