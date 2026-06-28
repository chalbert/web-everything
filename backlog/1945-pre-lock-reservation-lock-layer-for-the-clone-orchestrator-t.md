---
kind: story
size: 8
parent: "1143"
status: active
blockedBy: ["1938"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
tags: []
---

# Pre-lock reservation + lock layer for the clone orchestrator (the #1935/#1936 mandatory tier on top of the optimistic floor)

Build the mandatory pre-lock layer the #1933 clone orchestrator (slice 3, #1942) deliberately deferred. Slice 3 ships only the OPTIMISTIC git-merge floor (#1935 Option D) with post-hoc multiLaneFiles detection; this adds the pessimistic tier ratified by #1935 Fork 2 + #1936: before a lane edits a merge-risk file (the small residual set after #1938 shrinks it), it RESERVES that path via an atomic O_EXCL/lock-dir primitive under the central checkout (#1936 Fork 1a) with a heartbeat-TTL lease for stale-lock reclaim (#1936 Fork 2a); a second lane needing a held path waits or defers. Wire this into we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js so the central pre-claim/dispatch step assigns + enforces locks, preventing the wasted-lane and clean-but-wrong-structured-merge cases the optimistic floor only detects after the fact. Blocked by #1938 (shrink the monolith lock-set first).
