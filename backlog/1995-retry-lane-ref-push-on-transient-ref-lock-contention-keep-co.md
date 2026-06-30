---
kind: task
status: resolved
blockedBy: ["1933"]
dateOpened: "2026-06-30"
dateResolved: "2026-06-30"
graduatedTo: none
tags: []
---

# Retry lane-ref push on transient ref-lock contention (keep concurrency, don't fall to serial replay)

In the /workflow parallel model, each lane force-pushes its own distinct lane/<slug>-<n> ref to the shared WE origin. The push is a single attempt with no retry; concurrent lanes finishing near-simultaneously contend on git's ref-transaction lock (packed-refs.lock / per-ref .lock) and the loser is rejected ('cannot lock ref' / 'failed to update ref'). Observed 2/6 in the first green run (batch-2026-06-29b) — those lanes lost concurrency and fell to the integrator's serial replay. Fix: wrap step-4 push in a bounded retry with jittered backoff (~5 attempts, 0.3-0.8s). Force-push to a lane-owned ref is idempotent, so retry is correctness-safe; it converts a transient collision into a concurrent land. This is the 'residual push-reliability bug worth chasing' the parallel-workflow memory flagged.
