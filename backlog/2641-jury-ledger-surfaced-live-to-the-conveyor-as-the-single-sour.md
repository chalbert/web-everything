---
bornAs: xznjbt6
kind: story
size: 5
parent: "2636"
status: open
blockedBy: ["2639"]
scope: ["we:scripts/conveyor/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Jury ledger surfaced live to the conveyor as the single source of truth

Make the jury observable — this is what turns the conveyor improvement that started this epic into something real. Emit a structured, live jury ledger: the roster, each juror's charter/expectation, its status (pending / running / found), its findings, its current verdict, and the round number. Surface it to the conveyor as the **single source of truth** (a `/workflows`-style tree), never a parallel state store (#2612). `we:scripts/workflows/review-parked-prs.mjs` already *returns a ledger and nothing else* — extend that ledger with the per-juror live fields and pipe it into the conveyor loop (`we:scripts/conveyor/`, `we:skills-src/conveyor/`) so an operator sees what the jury is, is doing, and has found. Depends on the convergence loop producing the round-by-round events.
