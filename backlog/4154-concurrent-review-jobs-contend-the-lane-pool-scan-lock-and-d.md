---
bornAs: xs4ok3k
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/review-job.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Concurrent review jobs contend the lane-pool scan lock and defer instead of acquiring

Live on 2026-09-25 (4152 overlay): the review daemon dispatched 7 review jobs in one tick; 2 acquired lanes, 5 reported deferred-no-lane after ~250s because every concurrent acquire waited on the shared lane-pool acquirability scan lock (gave up waiting for the scan lock after 120000ms) while 26 lanes were acquirable. No session was burned (the next tick retries), but it delays reviews by a tick or more. Options: stagger job starts within a tick, have we:skills-src/conveyor/review-daemon.mjs pass one fresh scan result to the jobs, or raise we:scripts/operations/review-job.mjs REVIEW_JOB_LANE_WAIT_MS past the scan time.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
