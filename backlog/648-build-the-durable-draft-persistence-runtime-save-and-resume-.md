---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: []
---

# Build the durable draft-persistence runtime — save-and-resume snapshot + last-writer-wins co-edit (webstates storage facet per #011)

Persistence has **no shipping WE runtime**: [#011](011-gap-4-webpersistence-project.md) ruled the durable store a thin storage facet of `webstates` (IndexedDB + `navigator.storage.persist()`) and co-edit conflict a change-tracking strategy — but neither is built, so apps needing save-and-resume drafts hand-roll `localStorage`. Build the runtime: a durable **snapshot/restore** of an entity's working state (autosave-on-change → resume to the exact field state across sessions) with a pluggable store, plus the **last-writer-wins** co-edit primitive (per-editor token + `savedAt` compare + an "X also editing" signal over `storage`/BroadcastChannel). Surfaced + GAP-tagged by the loan-origination exercise app's S4 drafts phase ([#388](388-loan-phase-drafts.md)).
