---
kind: task
parent: "xtfrvc3"
status: open
blockedBy: ["xjko7gy", "3908"]
scope: ["we:scripts/operations/review-dispatch-wrapper.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 8: repo-aware mechanical review wrapper

On the mechanical-dispatcher branch the review wrapper builds its session name without the repo and acquires a lane without --repo, so a frontierui or plateau review would run in a WE lane under a WE-looking name (flagged in #3908 and #3803 Fork 1). Pass the repo to the session slug and to lane acquisition; lands with or after #3908.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
