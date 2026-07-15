---
bornAs: x7zaejl
kind: story
size: 5
parent: "2508"
status: resolved
dateOpened: "2026-07-15"
dateResolved: "2026-07-15"
graduatedTo: none
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: lane-gated write seam + resolve an item from the UI

Land the write path's foundation: the lane-gated mutation seam plus the safest first action — resolve an item from the UI. Per the epic's constraint a backlog mutation can't be a direct write, so the action requests a lane → PR (the same transport the CLI uses) and the UI reflects the in-flight mutation rather than pretending it is instant. Resolve is first because it is low-risk and well-defined.

**Acceptance:** a Resolve control on an eligible item opens a lane, splices status → resolved, and lands via PR; the row reflects pending → resolved as the mutation progresses; a failure surfaces honestly and nothing changes in the target repo until the PR lands.
