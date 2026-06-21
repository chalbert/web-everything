---
kind: task
status: open
blockedBy: ["1431"]
relatedProject: webintents
dateOpened: "2026-06-21"
tags: []
---

# Wire optimistic-revert rollback onto change-record (Change Tracking), jointly with #1394

Ratified by #1395 Fork 2(a): align the optimistic rollback contract on the `change-record` semantic / Change Tracking protocol — optimistic revert restores a record's `oldValue` (the inverse data `change-record` centralizes because RFC 6902 ops are not self-inverting), the same primitive #1394 undo/redo replays. resource-action MAY keep its 1-deep `previousState` snapshot as a permitted fast-path. Land jointly with #1394 so both inherit one reversibility primitive (or #1394 inherits this ruling). Blocked on #1431.
