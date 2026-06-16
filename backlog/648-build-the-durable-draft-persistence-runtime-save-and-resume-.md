---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:draft-persistence (blocks/draft-persistence/) — durable save-and-resume runtime: snapshot/restore behind a pluggable CustomStorageStrategy (IndexedDB default) + last-writer-wins co-edit, the #011 webstates storage facet"
tags: []
---

# Build the durable draft-persistence runtime — save-and-resume snapshot + last-writer-wins co-edit (webstates storage facet per #011)

Persistence has **no shipping WE runtime**: [#011](/backlog/011-gap-4-webpersistence-project/) ruled the durable store a thin storage facet of `webstates` (IndexedDB + `navigator.storage.persist()`) and co-edit conflict a change-tracking strategy — but neither is built, so apps needing save-and-resume drafts hand-roll `localStorage`. Build the runtime: a durable **snapshot/restore** of an entity's working state (autosave-on-change → resume to the exact field state across sessions) with a pluggable store, plus the **last-writer-wins** co-edit primitive (per-editor token + `savedAt` compare + an "X also editing" signal over `storage`/BroadcastChannel). Surfaced + GAP-tagged by the loan-origination exercise app's S4 drafts phase ([#388](/backlog/388-loan-phase-drafts/)).

## Progress

- Built the `draft-persistence` runtime Module under [blocks/draft-persistence/](/blocks/draft-persistence/) per the #011 ruling (storage facet of webstates):
  - [types.ts](/blocks/draft-persistence/types.ts) — the `CustomStorageStrategy` contract (#011 Fork 1A), `DraftSnapshot` (state + `savedAt` + editor token + schema version), co-edit types.
  - [storage.ts](/blocks/draft-persistence/storage.ts) — `IndexedDbStorageStrategy` (native-first default + `navigator.storage.persist()`), `LocalStorageStrategy` (degradation), `MemoryStorageStrategy` (SSR/test), and `pickDefaultStorage()` (IndexedDB → localStorage → memory).
  - [DraftPersistence.ts](/blocks/draft-persistence/DraftPersistence.ts) — the controller: `save`/`autosave` (debounced), `restore` (version-stale → discard), `discard`, `list`, and `reconcile` (last-writer-wins persist of the winner). Best-effort `requestPersistent()`.
  - [coedit.ts](/blocks/draft-persistence/coedit.ts) — pure `resolveLww` (later `savedAt` wins, tie→remote) + `CoEditCoordinator` ("X also editing" presence + conflict signal over BroadcastChannel, `storage`-event fallback; surfaces, does not merge).
- Registered in [src/_data/blocks.json](/src/_data/blocks.json) (type `Module`, webStandards: IndexedDB/persist/BroadcastChannel/localStorage, events `coedit-presence`/`coedit-conflict`, designDecisions) + description partial [src/_includes/block-descriptions/draft-persistence.njk](/src/_includes/block-descriptions/draft-persistence.njk). No `implementsIntent` — #011 explicitly ruled persistence is infrastructure, not an intent.
- 11 unit tests ([__tests__/draft-persistence.test.ts](/blocks/draft-persistence/__tests__/draft-persistence.test.ts)) — snapshot/restore across a session boundary, version-stale discard, debounced autosave coalescing, LWW reconcile both directions, storage strategies; all green. `tsc --noEmit` clean for the block; `check:standards` green (63 blocks); 11ty build smoke green.
