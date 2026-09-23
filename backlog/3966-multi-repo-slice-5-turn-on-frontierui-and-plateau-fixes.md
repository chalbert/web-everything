---
bornAs: x33jgwt
kind: story
size: 5
parent: "3963"
status: open
blockedBy: ["3958", "3959", "3960", "3965"]
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 5: turn on frontierui and plateau fixes

Replace the not-WE unsupported-repo refusal in we:scripts/conveyor/reconcile-fix-dispatch.mjs (590-598) with a capability check on the repo profile; freeLaneNumbers takes the target repo's lane pool; fix sessions and action-store resources keyed by repo; tryResumeFix and dispatchFix accept non-WE repos; pin the #3803 Fork 5 independence tests in the direction still reachable. Unblocks automatic fixes for plateau PRs that carry a backlog item (e.g. #177, #180).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
