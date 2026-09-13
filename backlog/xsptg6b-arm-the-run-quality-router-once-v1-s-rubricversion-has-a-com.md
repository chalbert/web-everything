---
kind: story
size: 2
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: one complete run population recorded under a single rubricVersion (#3649 Fork 3's well-defined population set)"
parkedDate: "2026-09-13"
blockedBy: ["3649"]
scope: ["we:scripts/conveyor/run-quality-route.mjs"]
dateOpened: "2026-09-13"
tags: [conveyor, run-quality, maturity-gated]
---

# Arm the run-quality router once v1's rubricVersion has a complete run population

#3649 Fork 7 ships v1 recording-only: the run-quality auditor's router (we:scripts/conveyor/run-quality-route.mjs) is built but disarmed behind a single flag. This card is the durable trigger to flip it — not a build to do now. Per #3649 Fork 7, the flag flips only once one complete rubricVersion population exists (Fork 3 makes 'complete population for a version' a well-defined set); per Fork 4, the accrual par-band threshold is proposed at that point as an ordinary (batched) finding through the router's own routing, never a separate ceremony, and no numeric N is owned before then. Do not build this until that population exists — file it now so the follow-through is not lost to chat memory.

Held `maturityGated`, not `blockedBy` alone: `#3649` gates *whether* the router mechanism may exist at all
(the decision), while this card's own trigger is a *data* threshold on top of that — a real run population
under one `rubricVersion`, which cannot exist until the scorer/router/store from `#3649` are themselves built
and running for a while. Un-park when that population exists; propose the numeric accrual threshold at the
same time, per Fork 4, as an ordinary finding — no separate ceremony.

## Done when

1. **Executable** — the router's disarm flag (`we:scripts/conveyor/run-quality-route.mjs`) is flipped to
   armed for the work-agent class, and `assessMissingOperationConfidence`-clean findings begin auto-applying
   through the normal review path (Fork 6); a driver-class subject stays report-only regardless (Fork 5 —
   never revisited by this card).
2. **Grounded** — the un-park cites the specific `rubricVersion` and run-population evidence that satisfied
   the `adoptionSignal` trigger above.
