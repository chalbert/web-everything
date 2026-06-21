---
kind: task
status: resolved
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/blocks/resource-action.json"
tags: []
---

# Wire optimistic-revert rollback onto change-record (Change Tracking), jointly with #1394

Ratified by #1395 Fork 2(a): align the optimistic rollback contract on the `change-record` semantic / Change Tracking protocol — optimistic revert restores a record's `oldValue` (the inverse data `change-record` centralizes because RFC 6902 ops are not self-inverting), the same primitive #1394 undo/redo replays. resource-action MAY keep its 1-deep `previousState` snapshot as a permitted fast-path. Land jointly with #1394 so both inherit one reversibility primitive (or #1394 inherits this ruling). Blocked on #1431.

## Progress

- Aligned the rollback contract in we:src/_data/blocks/resource-action.json `designDecisions.optimisticRevert`:
  optimistic revert restores the `change-record` `oldValue` (the inverse data change-record centralizes
  because RFC 6902 ops aren't self-inverting) — the SAME reversibility primitive the undo-history block
  (#1438, realizing #1394) replays for undo, both routed through the Change Tracking protocol.
- Recorded the #1394 Fork 4a separation: a failed-write rollback runs a SEPARATE runtime from the user
  undo stack (a rollback must never become a user-undoable step) — consistent with the undo-history block's
  `separateRuntimeFromOptimisticRollback` designDecision I authored in #1438.
- The `resource-action-revert` event's 1-deep `previousState` snapshot is documented as a permitted
  fast-path OVER the shared contract, not a divergent second mechanism.
- This is the contract-alignment half; #1394's realization (#1438 undo-history block) already inherited the
  shared primitive, so the two now reference one reversibility model. Cleared the stale `blockedBy: ["1431"]`.
