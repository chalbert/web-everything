---
kind: story
size: 3
parent: "2508"
status: open
blockedBy: ["x7zaejl"]
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: claim and release an item from the UI

Claim and release an item from the UI, on the write seam. Claiming takes the status:open → active ownership lock a session holds; releasing hands it back. It reflects and drives the same claim state the loop machinery already reads, so a reader can take or free work without dropping to the CLI.

**Acceptance:** a Claim control locks an open item to the current session and a Release control clears it, each via the lane-gated write path; the row shows claimed / owner state; claiming an already-claimed item is refused with a clear reason.
