---
bornAs: x8lajxj
kind: epic
status: open
dateOpened: "2026-07-23"
tags: []
---

# Jury-based PR review to convergence

Every parked PR should be judged by a jury *sized and equipped to the change*, running a bounded fix↔review loop that either converges to a verdict or hands a deadlock to a human — with the whole jury (who, doing what, found what) live to the conveyor. Extends #2285 (the deferred panel↔editor convergence loop) and #2567 (care-level → panel rigor). Builds on primitives already in `we:scripts/lib/review-core.mjs` (`panelRigorForCareLevel`, `buildEditorMandate`, `deriveNegotiationOutcome`, `DIVERSITY_SELECTION`).

Invariants carried, not re-litigated: aggregation stays diversity-selection (strictest juror wins, never a majority vote); a `review:human` PR is never agent-cleared; escalation is by **max round-trips, never a clock**. Settled design calls: early human alignment (jury pre-registered at prepare); config in a human-gated contract with per-item override; roster binds against the real diff at open and drift past registration re-triggers alignment. Knobs to make configurable: jury size, round-trip cap, method↔lens attachment, roster-timing strictness.
