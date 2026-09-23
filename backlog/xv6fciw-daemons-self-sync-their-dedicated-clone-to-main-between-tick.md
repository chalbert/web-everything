---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/lib/daemon-self-sync.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# daemons self-sync their dedicated clone to main between ticks and restart on new code

Live pain 2026-09-22/23: the review and fix-dispatch daemons run from a dedicated clone (wev-review-daemon) that falls behind origin/main within minutes (main lands PRs every few minutes); every tick then refuses every dispatch via assertMainNotStale until someone fetch+merges by hand -- done 5+ times in one day, and it is the main reason PRs stopped moving. The clone is also usually AHEAD (launch-from-lane merges of unmerged fixes), so a fast-forward never applies. Narrow slice of the open decision #3681 (which also covers hot-reload and the drain/runner, not ruled here): before each tick, fetch origin/main; if behind on a CLEAN tree, merge it (a merge commit, not ff); on conflict, abort and leave the tree exactly as it was; if the merge brought in new commits, release the lease and exit 0 BETWEEN ticks (never mid-dispatch) so launchd KeepAlive restarts the daemon on the new code. A dirty tree is never touched. New shared module we:scripts/lib/daemon-self-sync.mjs, wired into we:skills-src/conveyor/review-daemon.mjs and we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
