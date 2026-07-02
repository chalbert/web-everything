---
kind: story
size: 3
parent: "2162"
status: open
blockedBy: ["2172"]
dateOpened: "2026-07-02"
tags: []
---

# Drain reopen-on-fail: leave a failed couple queued, reconcile a stranded/partial item back to open

The drain-side of the #2072 reconcile. When a couple fails to land (impl merge red, WE resolve unreachable, cross-repo partial), the drain leaves it queued (never falsely resolved) and reconciles a stranded/partial WE item back to status:open via we:scripts/backlog.mjs release, preserving durable lane/* refs for the next drain pass.
