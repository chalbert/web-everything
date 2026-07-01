---
kind: task
parent: "1971"
status: resolved
blockedBy: ["2002"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# moveBefore state-preserving moves in ForEach reconciliation

In slice C's reconciliation reorders, use Element.moveBefore() (feature-detected, insertBefore fallback per the ratified pattern in fui:blocks/renderers/reorderable-list/reorderState.ts:36-48 and sibling #1969) so reused nodes keep focus/media/iframe state across reorders. Slice D of #1971.
