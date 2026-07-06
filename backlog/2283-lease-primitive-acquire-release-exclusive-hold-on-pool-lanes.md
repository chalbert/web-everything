---
kind: story
size: 2
parent: "2275"
status: resolved
blockedBy: ["2267"]
dateOpened: "2026-07-06"
dateResolved: "2026-07-06"
graduatedTo: none
tags: []
---

# Lease primitive: acquire/release exclusive hold on pool lanes

First slice of #2275 (delivered via PR #167). we:scripts/lane-pool.mjs gains acquire (atomic O_EXCL claim of a .git/.lane-lease marker — auto-picks the lowest free lane or honors --lane=N, then resets to origin/<branch> so a leased lane may sit on main) and release (ownership-guarded, --force/--all). refresh/provision skip a live-leased lane exactly like a dirty/ahead one (#2267), so a held lane is never reset out from under its consumer; status surfaces the lease. Pure decision core in we:scripts/lib/lane-lease.mjs (TTL staleness + reclaim, acquirability, lowest-index choice) with 18 unit tests. Consumer contract: set LANE_SESSION or --session so acquire and release share one identity.
