---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# approved PRs that drift into a merge conflict are never resolved

Live 2026-09-23: four approved PRs (WE #2503, #2505, #2514, #2515) sat DIRTY with nothing acting on them. we:scripts/conveyor/parked-pr-conflict-watch.mjs only targets PRs with an uncleared hold (review:human / pending / changes), and the drain silently skips a conflict it cannot rebase-drop. Widen the watch to approved/queued PRs (review:accepted or ready-to-merge): label and comment at once, then bounce to review:changes via the existing reconcile-finding path only if still conflicting 30 minutes later (the drain's chance to heal a manifest-only conflict), so the fix daemon resolves it and the resolved diff is re-reviewed. Statute-tier conflicts still go straight to a human. Also: the watcher was never running as a daemon -- start parked-pr-conflict-watch-<repo> for all three repos under launchd like the lane-pool-health watchers.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
