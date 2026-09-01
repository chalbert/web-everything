---
bornAs: xg5ml6o
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
scope:
  - we:skills-src/conveyor/delivery-agent-brief.md
  - we:scripts/backlog.mjs
---

# A build-dispatch agent whose PR merges must resolve its own backlog item, not leave it active forever

Found live 2026-09-01, closing out this same session. `#3412`'s own build agent (`conveyor-3412`) opened
`PR #1765`, which merged hours ago — but the backlog item stayed `status: active` and the dispatched session
stayed `state: working` the entire time, never releasing its lane, never resolving the item, never exiting.
Both had to be cleaned up by hand at session close (`claude stop`, then `node we:scripts/backlog.mjs resolve`).
The operator, 2026-09-01: "we'll have to make sure our mechanic closes the item once done." Distinct from
`#3435` (mechanically REAP a finished session's process registration) — this is about the ITEM's own
status, not the session's; a dispatch could in principle exit cleanly while still leaving its backlog item
`active` forever, or vice versa. Related, not the same gap.

## Done when

1. **Executable** — `we:skills-src/conveyor/dispatched-agent-system-prompt.md` (or the build-dispatch brief,
   wherever the actual "your job is done" step lives) instructs a dispatch to resolve the backlog item it
   built (`node we:scripts/backlog.mjs resolve <NNN> --graduated-to=<what it became>`) as part of its own
   normal exit sequence, once its PR has actually merged — not just release the lane and stop.
2. A real test or a live-fire proof that a build dispatch's own item transitions to `resolved` without a
   human doing it by hand, mirroring how `#3412` had to be resolved manually tonight.
