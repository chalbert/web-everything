---
bornAs: xsed2mb
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Cap bot concurrency by machine load

2026-09-24: the host load average climbed high while daemons kept launching sessions. Admission for new dispatched sessions reads the host's load (the host-sampler records) and holds new launches above a threshold, beside the fixed lane ceiling. Relates to #3612 (MAX_CONCURRENT_LANES), #3806 (weighted worker budget decision), #3727 (review and fix under the shared ceiling), #3973 (delivered work per hour against load).

## Done when

1. **Executable** — a test proves a new dispatched session is held when the sampled load is above the
   threshold and admitted when it drops, beside the existing lane ceiling.
2. **Live proof** — under real high load, the dispatch log shows launches held, with before/after load
   readings.
