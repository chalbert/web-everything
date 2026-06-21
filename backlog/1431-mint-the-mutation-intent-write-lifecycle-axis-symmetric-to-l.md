---
kind: story
size: 5
status: resolved
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/mutation.json"
tags: []
---

# Mint the mutation intent — write-lifecycle axis symmetric to loader

Ratified by #1395 Fork 1(a): mint a first-class `mutation` intent owning the write-lifecycle axis (strategy optimistic/pessimistic · rollback · reconcile · doubleSubmit · busy), symmetric to `loader` for reads. Author we:src/_data/intents/mutation.json + its /intents/ page + nav. Default strategy = pessimistic (always-safe; optimism is the opt-in). Draws on `action` for trigger visual-weight; composes `reliability` for the failure branch. Unblocks the resource-action retarget.

## Progress

- Minted we:src/_data/intents/mutation.json (auto-renders at /intents/mutation/ via
  we:src/intent-pages.njk — no manual nav entry needed; `status: draft` since the running lifecycle
  already ships as resource-action). Added the glossary term we:src/_data/semantics/mutation.json.
- Five dimensions per the ruling: `strategy` (pessimistic default / optimistic opt-in), `reconcile`
  (invalidate default / merge / trust), `rollback` (snapshot default / none — snapshot is a FIXED
  mechanic under optimistic), `doubleSubmit` (prevent default / queue / allow — fixed-mechanic guard),
  `busy` (disabled default / interactive — composes action.busy).
- Composition seams named in prose (all supported, no forks): ↔ loader (read/write split), ↔ reliability
  (failure branch), ↔ action (trigger weight + busy), ↔ Change Tracking / change-record (the shared
  reversibility record undo/redo #1394 also consumes). Links the running impl (resource-action) and the
  research topic (/research/optimistic-mutation-lifecycle/).
- The resource-action retarget (repoint `implementsIntent`/`intentDimension` off loader.strategy onto
  mutation) is downstream follow-up work, not part of this mint.
- Cleared the stale `blockedBy: ["1395"]` edge (#1395 resolved).
