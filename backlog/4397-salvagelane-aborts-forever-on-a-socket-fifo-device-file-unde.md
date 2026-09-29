---
bornAs: x7pj0mw
kind: task
parent: "4075"
status: open
blockedBy: ["4273"]
scope: ["we:scripts/lib/lane-salvage.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# salvageLane aborts forever on a socket/FIFO/device file under .claude/worktrees/

#4273's salvageLane copies every unregistered .claude/worktrees/ entry with fs.cpSync (recursive, dereference:false). cpSync throws on a non-regular special file (a Unix socket, FIFO, or device node), which aborts the WHOLE salvage — and since salvageLane's own contract is 'throw before any reset/clean', the lane can never be reclaimed via the salvage path until an operator manually removes the offending file by hand. Surfaced by an automated review during #4273's build (security lens, degraded impact, carve-out — not required to land #4273 itself). Done when: salvageLane either (a) detects a non-regular/non-symlink/non-file/non-directory entry via lstat and skips it with a recorded reason (never silently), or (b) catches the specific cpSync special-file error class and degrades that one item gracefully instead of aborting the whole salvage — plus a test that places a real Unix socket or FIFO under .claude/worktrees/ and asserts the lane is still salvaged/reclaimable afterward.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
