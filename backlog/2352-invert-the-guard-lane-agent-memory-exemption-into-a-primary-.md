---
kind: story
size: 2
parent: "2301"
status: open
blockedBy: ["2350"]
dateOpened: "2026-07-09"
tags: []
---

# Invert the guard-lane agent-memory exemption into a primary-only deny-with-reason backstop

Delete the inAgentMemory allow carve-out at we:scripts/guard-lane.mjs:54-61 and replace it with a deny-with-reason that fires only when a write realpaths into the PRIMARY agent-memory-src/ (or the user-skills dir) — the same primary-leak class. In the happy path (memory now resolves to the dedicated lane, blocked-by 2350) it never fires; it catches a mis-pointed symlink or a stray direct primary write loudly instead of silently dirtying the tree. Blocked by the repoint slice so the deny never fires while the symlink still resolves to primary (would break the loop). Slice of #2301.
