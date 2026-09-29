---
kind: story
size: 5
status: open
blockedBy: ["4296"]
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/verify-lane-gate.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Workers lose 35-43% of build time waiting on the verify gate — cut repeat verifies and the wait

Measured 2026-09-29 from worker transcripts (tool time vs wall): worker #4296 90 min wall, 38.6 min (43%) in the verify gate (35 polls of the verify check with a 60s wait); worker #4304 91 min, 31.8 min (35%) verify + 11.9 min vitest; worker #4297 60 min, 14.3 min verify + 10.2 min open-pr. Model time between calls is ~40-50%, the rest is small. The verify daemon log shows 131 dispatches with the same lane+sha verified repeatedly (lane-36 x8, lane-8 x6, lane-21 and lane-17 x4, lane-22 x3): a worker re-requests after each edit while HEAD is unchanged (work uncommitted), and each run is a full vitest-related plus check:standards. Related-file lists also include lane scratch files (the commit-message, PR-body and converge-state files). MVP: (1) verify requests keyed to working-tree content (depends on #4296, key the marker to what changed) so an unchanged tree is answered from the cached result instantly; (2) when a heavy slot is free, run the gate inline for the requester instead of queue-and-poll (we:scripts/verify-lane.mjs request/check, we:scripts/readiness/heavy-admission.mjs); (3) exclude lane scratch files from the related set. Must: measured before/after on a real worker build (verify minutes and verify dispatch count per build).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
