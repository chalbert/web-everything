---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build draft-persistence FUI block impl

Build draft-persistence in `fui:blocks/draft-persistence/` (contract: we:src/_data/blocks/draft-persistence.json). Durable save-and-resume behind a pluggable CustomStorageStrategy (IndexedDB native-first, localStorage degradation, in-memory test fallback) + last-writer-wins co-edit (per-editor token + savedAt compare + also-editing presence over BroadcastChannel/storage). locus frontierui. Slice of #904 (webstates #011).
