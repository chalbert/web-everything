---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-31"
tags: []
---

# Should the mechanical dispatcher auto-file a fix item when it hits a real delivery hiccup, gated by approval at first?

The learnings pool (~/.claude/conveyor/learnings/*.jsonl) already captures friction from every session, and /harvest later judges and routes survivors to backlog items -- but that is a periodic, human-triggered sweep, not the dispatcher itself noticing a hiccup mid-delivery and mechanically filing + queuing the fix right then. #3416 tonight is the concrete case this would have caught immediately rather than at the end of a long session's own write-up: a real, reproducible bug found while exercising the dispatcher live. The operator's own framing (2026-08-31): the system should be able to capture hiccups during delivery and mechanically create fix items and queue them to self-improve, with some approval gate at first rather than fully unattended. This is the same shape as the already-ratified #3405 doctrine (a dispatched agent that hits a gap halts and surfaces a missing-operation finding rather than working around it silently) generalized from ONE gap class (a missing operation) to delivery hiccups more broadly, and it needs the same kind of fork-based decision #3405 got rather than being built ad hoc: what counts as a hiccup worth auto-filing (a crash vs. a suppressed dispatch vs. a slow gate) versus noise not worth a card; whether the FIRST version gates every auto-filed item behind an explicit human approval before it is queued (matching the operator's own 'with some approval at first'), or only gates the riskier subset; and where this lives relative to the existing learnings-pool/harvest pipeline -- a parallel fast path for delivery-time hiccups specifically, or a new, more mechanical trigger into the SAME pool. Capture-only for now -- no build required to close it, mirroring #3049's own shape.

## Done when

1. A ruling is recorded here on: (a) what counts as an auto-filable hiccup vs. noise, (b) whether every
   auto-filed item is gated behind human approval before it queues, or only a riskier subset, and (c) whether
   this is a new fast path or a new trigger into the existing learnings-pool/`/harvest` pipeline.
2. If the ruling calls for building anything, a follow-up story is filed under this card naming the concrete
   scope — this decision itself stays capture-only, mirroring `#3049`.
