---
bornAs: xznjbt6
kind: story
size: 8
buildQueued: true
parent: "2636"
status: open
blockedBy: ["2639"]
scope: ["we:scripts/lib/", "we:scripts/conveyor/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Jury ledger surfaced live to the conveyor as the single source of truth

Make the jury observable — this is what turns the conveyor improvement that started this epic into something real. Emit a structured, live jury ledger: the roster, each juror's charter/expectation, its status (pending / running / found), its findings, its current verdict, and the round number. Surface it to the conveyor as the **single source of truth** (a `/workflows`-style tree), never a parallel state store (#2612).

**Rescoped by the jury-of-#2576 ruling (F4 = logbook).** The earlier in-memory "return a ledger" sizing is superseded. The jury now writes an **append-only event log persisted to disk**, and a **SINGLE SHARED fold module** reconstructs current state from that log — written once, called by BOTH the conveyor tick AND the #2642 console. The jury appends events (roster picked, juror running, finding, verdict, round advanced) to the durable on-disk log; the fold replays them into the current ledger the conveyor's `/workflows`-style tree renders, and the #2642 console reads the same fold. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

**Guardrail — the fold is written once, never two copies.** There must be exactly ONE fold module (in the WE core, [we:scripts/lib/](scripts/lib/)); the conveyor and the plateau-app console both call it. A second copy of the fold logic in either consumer is a bug. `we:scripts/workflows/review-parked-prs.mjs` already *returns a ledger and nothing else* — evolve it to append events to the durable log, and pipe the shared fold's output into the conveyor loop ([we:scripts/conveyor/](scripts/conveyor/), `we:skills-src/conveyor/`) so an operator sees what the jury is, is doing, and has found.

**Size grows accordingly** — bumped 5 → 8: this is no longer an in-memory ledger return but a durable event log plus a shared fold with two consumers. Depends on the convergence loop producing the round-by-round events.
