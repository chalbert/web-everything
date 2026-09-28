---
bornAs: x74f2cl
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/verify-lane.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Verify-dispatch concurrency: cap-bounded execution + onGateStarted wiring lack direct tests

#4360 made we:scripts/conveyor/verify-dispatch.mjs#runVerifyDispatch offer every pending lane's gate to the heavy-admission semaphore at once instead of one at a time. Real concurrent gate execution is bounded only by each spawned we:scripts/verify-lane.mjs child's own acquireSlotBlocking wait against we:scripts/readiness/heavy-admission.mjs's cap, which fails open on a queuing timeout (documented, pre-existing) — so a backlog larger than the cap can, in principle, run more gates concurrently than the cap names. Two independent converge review rounds (#4360) raised this consistently but classified it as a carve-out (not release-blocking), since the daemon-side fan-out change is deliberate per #4360's own corrected plan and adding a second admission chokepoint in the daemon would be wrong. What is missing is test coverage for the properties that keep it safe: (1) a real multi-lane integration test (N pending lanes greater than a small real admission cap) asserting peak held slots never exceeds the cap while all N lanes still eventually reach a terminal marker; (2) a test that runVerifyDispatch's OWN onGateStarted wiring (not just spawnGateBounded's hook in isolation) actually logs the gate-started line for a real dispatched lane — the existing concurrent-dispatch tests use a fake spawnGate that ignores it; (3) a code-level check (or a repeated code comment is not enough) that we:scripts/conveyor/verify-dispatch.mjs never itself calls acquireSlotBlocking, so a future edit cannot accidentally add a second admission chokepoint. Edge cases the new tests must cover: N pending lanes where N is 2x and 3x the real cap; a lane whose child fails open (proceeds unslotted) still gets counted correctly in dispatched/failures; the onGateStarted log line's timestamp actually reflects the real per-lane gate start, not the dispatch/offer time.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
