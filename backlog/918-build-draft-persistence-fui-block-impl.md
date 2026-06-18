---
type: issue
workItem: story
size: 5
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/draft-persistence/DraftPersistence.ts
tags: []
---

# Build draft-persistence FUI block impl

Build draft-persistence in `fui:blocks/draft-persistence/` (contract: we:src/_data/blocks/draft-persistence.json). Durable save-and-resume behind a pluggable CustomStorageStrategy (IndexedDB native-first, localStorage degradation, in-memory test fallback) + last-writer-wins co-edit (per-editor token + savedAt compare + also-editing presence over BroadcastChannel/storage). locus frontierui. Slice of #904 (webstates #011).

## Built (batch-2026-06-18)

Shipped in **frontierui** at `blocks/draft-persistence/` (Module, no element):

- **`fui:storage.ts`** — the `CustomStorageStrategy` seam + `MemoryStorageStrategy`,
  `LocalStorageStrategy` (prefixed), `IndexedDbStorageStrategy` (native-first), `pickDefaultStorage`
  (IDB→local→memory, `nativeFirstWithDegradation`), `requestPersistent`, `DraftSnapshot`.
- **`fui:coedit.ts`** — `resolveLww` (later savedAt wins, ties→remote, #011 Fork 3) + `CoEditCoordinator`
  (hello/saved/bye over BroadcastChannel, localStorage+storage-event fallback; tracks peers, fires
  `coedit-presence`/`coedit-conflict`; never merges — `presenceNotMerge`), `CoEditor`, `LwwResult`,
  `PRESENCE_EVENT`/`CONFLICT_EVENT`, injectable `MessageBus`.
- **`fui:DraftPersistence.ts`** — the controller: `load` (resume), `update` (debounced autosave-on-change),
  `save`/`flush`/`clear`, `reconcile` (LWW), `startCoEdit`/`peers`/`stopCoEdit`; `DraftPersistenceOptions`,
  `DraftPersistenceConfig`, `DEFAULT_CONFIG`. Re-exports the full contract surface.
- **FUI `fui:src/_data/blocks.json`** — new `draft-persistence` family entry (protocol webstates).

Pure-logic split: storage + LWW are DOM/IO-isolated and unit-tested without IndexedDB or tabs (bus
injected). Gate: `check:standards` green (0 errors; 32 blocks), 12 vitest specs pass, `tsc` clean.
