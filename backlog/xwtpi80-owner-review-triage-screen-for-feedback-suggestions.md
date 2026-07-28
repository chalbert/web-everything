---
kind: story
size: 5
parent: "2610"
status: open
blockedBy: ["xhwesfo"]
scope: ["plateau:src/backlog-view/", "we:scripts/lib/", "we:scripts/conveyor/learnings-dedup.mjs", "plateau:src/mock-server/server.ts"]
dateOpened: "2026-07-28"
tags: []
---

# Owner-review triage screen for feedback suggestions

The multi-tenant owner triage screen where opt-in suggestions are reviewed and accepted or rejected, reusing the ratified console grammar: the closed verdict vocabulary (plateau:src/backlog-view/webcases-review.ts), queue-with-peek (plateau:src/backlog-view/queue-view.ts), the triage stepper (plateau:src/backlog-view/micro-decision-surface.ts), and dedup-before-expensive-review (we:scripts/conveyor/learnings-dedup.mjs). New surface under plateau:src/backlog-view/ plus a WE surfacing half and a read route on plateau:src/mock-server/server.ts. Reads the schema the capture slice defines.
