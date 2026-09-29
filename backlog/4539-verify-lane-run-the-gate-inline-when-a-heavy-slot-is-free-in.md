---
bornAs: x5awn7x
kind: story
size: 3
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# verify-lane: run the gate inline when a heavy slot is free, instead of queue-and-poll

Split from #4473 MVP item (2). we:scripts/verify-lane.mjs request currently always defers to we:scripts/conveyor/verify-dispatch.mjs's next tick even when acquireSlotBlocking (we:scripts/readiness/heavy-admission.mjs) could grant a slot immediately, forcing an unconditional round-trip (request, then poll check) for every verify, even when there is zero queue contention. When a slot is free at request time, run the gate inline (synchronously, in the requesting process) instead of stamping running and waiting for the daemon's next tick; when no slot is free, keep the existing queue-and-poll path unchanged. Edge cases to name explicitly in the build: (a) a slot that frees between the admission check and the inline run starting (no double-run/double-slot-consumption), (b) the inline path must still write the SAME running/green/red marker lifecycle request already contracts (no new marker vocabulary), (c) an inline run that itself takes the full 150-350s must not block past this tool's foreground window when called from an interactive agent session (we:scripts/guard-bash.mjs's allow-list implications), (d) we:scripts/conveyor/verify-dispatch.mjs's own dispatch of a lane already inline-completed must not double-dispatch it. Needs a real-git integration/wiring test proving the inline path actually executes end to end (not just a unit test of the admission check), plus a wiring test that we:scripts/conveyor/verify-dispatch.mjs correctly skips a lane already inline-verified.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
