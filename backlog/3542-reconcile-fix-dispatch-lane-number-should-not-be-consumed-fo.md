---
bornAs: xazl9u3
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-06"
tags: []
---

# reconcile-fix-dispatch: lane number should not be consumed for a conflict entry that resumes

PR #1966's independent review (correctness finding, 3544): runReconcileFixDispatch pops a fresh lane number for every planned fix, including a conflict-caused entry that ends up resuming its original session and using no lane at all. In a tick where free lanes are scarce this wastes one for nothing (self-corrects next tick since pickFreeLanes re-reads the pool fresh). Have the resume-candidate check (or a peek at it) run before a lane is committed from the pool, so a successful resume never removes a lane number in the first place; cover with a test asserting a resumed entry leaves the lane pool untouched.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
