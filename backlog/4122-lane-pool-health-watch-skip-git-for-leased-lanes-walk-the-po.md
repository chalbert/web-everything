---
bornAs: xdtot9p
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Lane-pool health watch: skip git for leased lanes, walk the pool once per tick, log only changed verdicts

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Finding P1 (batch it plus change detection). we:scripts/conveyor/lane-pool-health-watch.mjs (190-241) shells 4 full-pool commands per tick. we:scripts/lane-pool.mjs laneStatus (994-1018) spawns 4 git calls per lane with no lease-first skip, unlike laneAcquirableInfo (1037-1060); porcelain is then read a second time per lane. With the WE pool at 70-115 lanes that is 300-500 git spawns per tick; WE mean tick about 65 s against about 15 s for the smaller pools. The watch logs one line per lane per tick even when nothing changed, so lane-pool-health-watch-we.log reached 15 MB. Fix shape: lease-first skip in laneStatus, one pool snapshot shared by the four consumers, log a lane line only when its verdict changed. Done when: tests; LIVE proof: WE watch mean tick and log bytes per hour over 2 h before/after, in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
