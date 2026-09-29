---
kind: task
status: open
blockedBy: ["4308"]
dateOpened: "2026-09-28"
tags: []
---

# plateau-app drain-daemon projection: surface overlapYield in the deferred listing

#4308 added an `overlapYield: {pr, repo, files, untilMs, windowMinutes}` field to the drain's deferred entries. `plateau:tools/drain-daemon/lib.mjs` currently keeps `waitOn` but drops every OTHER deferred field when it projects a pass result (near line 405), and its stall detector treats any deferral as explained non-progress (near line 648). Surface `overlapYield` (target PR, files, release time) in that projection so an operator watching the resident daemon can see WHY a PR is waiting, not just that it is. Edge cases: a deferred entry with no `overlapYield` field (every other wait reason) must project exactly as before; the per-X budget (#4308 rule 6) already bounds how long a stall can be muted by a yield, so the stall detector's own logic does not need to change, only what it displays. Needs an integration/wiring test in plateau-app's own drain-daemon test suite exercising a real projected pass, not just a unit test of the field mapping.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
