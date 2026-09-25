---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["x6sslco"]
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:skills-src/conveyor/verify-daemon.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Verify daemon: each gate run is a detached job with its own record, not an awaited child

Slice of decision x6sslco (daemon job model); audit we:reports/2026-09-24-daemon-blocking-antipatterns.md. Filed uncleared until x6sslco is ratified; the shape below follows its bold defaults and changes with the ruling. Finding V1, structural part (after xpe1s8f fixes the heartbeat). we:scripts/conveyor/verify-dispatch.mjs awaits each lane's gate (up to 30 min plus queue time) one lane after another. Shape: each gate run becomes a job keyed by (pool, lane, headSha), so a restart of the verify daemon reattaches instead of re-running, and lanes run up to the verify cap in parallel under the existing heavy-command admission. Done when: tests; LIVE proof: restart the verify daemon mid-gate and show the gate finishes once with one verdict marker.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
