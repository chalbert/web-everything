---
bornAs: x21xsa9
kind: task
parent: "3383"
status: open
scope: ["we:scripts/lib/lane-lease.mjs", "we:scripts/conveyor/lease-reaper.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# Lane leases held by already-dead PIDs were not reclaimed automatically -- live incident, lane-1/lane-3, PIDs 95707 and 96033

Live incident, 2026-09-13/14: lane-1 and lane-3 leases were held by PIDs 95707 and 96033, both already exited, and neither we:scripts/lib/lane-lease.mjs isLeaseStale (a pure TTL check, DEFAULT_LEASE_TTL_MINUTES=240) nor the session-gone axis in we:scripts/conveyor/lease-reaper.mjs (the mechanism this repo already built precisely because a literal lease.pid check cannot work -- that pid is only the short-lived lane-pool acquire CLI, never the delivery agent) reclaimed either lane; both were released by hand. This is a different concern from #3655, which is scoped to we:scripts/conveyor/session-reaper.mjs and we:scripts/conveyor/driver-watchdog.mjs (idle peer sessions and orphaned watchers), not lane leases, and should not be folded into it. Needs root-causing before the evidence is lost: did the session-gone axis run and fail to match because these two leases carried a purpose-only session (merge-mechanical-dispatcher-main) rather than a numbered-item session that itemNumFromSession in we:scripts/conveyor/lease-reaper.mjs can parse, did the claude agents listing degrade to unavailable, or is there a genuine hole in the reap chain for a non-item-numbered lease purpose. Capture the real lease records (session name, acquiredAt, purpose) from this incident while still available, then close whatever gap is found.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
