---
bornAs: xmtbdgs
kind: task
parent: "3963"
status: active
blockedBy: ["3966", "3965"]
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
tags: []
---

# Multi-repo slice 6: fix PRs that have no backlog item

PRs on branches like lane/wip-* (plateau #170/#171, fixed by hand 2026-09-23) map to no item and are refused as no-item-num. Attribute the fix to the PR itself with scope from its diff under the right repo prefix -- the branch commit 08ff516f3 held inside #3908 already does the attribution half.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
