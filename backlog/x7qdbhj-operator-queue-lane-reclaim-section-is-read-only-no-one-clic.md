---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/operations/operator-queue.mjs", "we:scripts/lane-pool.mjs", "we:scripts/lane-whois.mjs", "we:scripts/lib/lane-whois-core.mjs", "we:scripts/operations/__tests__/operator-queue-lane-reclaim.test.mjs"]
relatedTo: ["4058", "4116"]
dateOpened: "2026-09-25"
tags: []
---

# operator-queue LANE RECLAIM section is read-only — no one-click reclaim or keep for finished-needs-review lanes

we:scripts/operations/operator-queue.mjs's laneReclaimQueue lists every finished-needs-review / unknown-work lane (37 finished-needs-review lanes live on 2026-09-24) under LANE RECLAIM, but the section is pure display: an operator who reads it still has to run we:scripts/lane-pool.mjs by hand, and there is no way to mark a lane keep so it stops resurfacing every tick. we:scripts/lane-pool.mjs reclaim (added by #4116) only actions the finished-reclaimable verdict, which is auto-safe by preservation proof; finished-needs-review is deliberately NOT auto-reclaimed because it needs a human call. Add: (1) a one-click reclaim action the operator can run against a queued finished-needs-review lane once they have looked at it (an operator override of we:scripts/lane-pool.mjs reclaim's normal finished-reclaimable-only gate, explicit and logged, never automatic); (2) a keep action that records the decision (a small durable marker, mirroring how we:scripts/conveyor/stand-down.mjs records a terminal marker) so laneReclaimQueue excludes that lane until its state changes again. Wire both into we:scripts/operations/operator-queue.mjs's LANE RECLAIM section.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
