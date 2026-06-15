---
type: issue
workItem: story
size: 3
parent: "658"
status: open
blockedBy: ["693"]
dateOpened: "2026-06-15"
tags: []
---

# Migrate background-task-surface UP to @frontierui/blocks

S2b of #658. Migrate the background-task-surface family UP to @frontierui/blocks (12 files: BackgroundTasksElement, index, registerBackgroundTasks, types, reloadDurabilityAdapter, the 6 traits/with* mixins, __fixtures__/mock-loader) + its tests, byte-verified against WE's copy, WITHOUT deleting WE's copy (#170 guard). Add to the S1 exports map. Independent of S2a/S2c. Leaves both trees valid.
