---
bornAs: xznjbt6
kind: story
size: 8
buildQueued: true
parent: "2636"
status: resolved
blockedBy: ["2639"]
relatedTo: ["2500"]
scope: ["we:scripts/lib/", "we:scripts/conveyor/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Jury ledger surfaced live to the conveyor as the single source of truth

Make the jury observable — this is what turns the conveyor improvement that started this epic into something real. Emit a structured, live jury ledger: the roster, each juror's charter/expectation, its status (pending / running / found), its findings, its current verdict, and the round number. Surface it to the conveyor as the **single source of truth** (a `/workflows`-style tree), never a parallel state store (#2612).

**Rescoped by the jury-of-#2576 ruling (F4 = logbook).** The earlier in-memory "return a ledger" sizing is superseded. The jury now writes an **append-only event log persisted to disk**, and a **SINGLE SHARED fold module** reconstructs current state from that log — written once, called by BOTH the conveyor tick AND the #2642 console. The jury appends events (roster picked, juror running, finding, verdict, round advanced) to the durable on-disk log; the fold replays them into the current ledger the conveyor's `/workflows`-style tree renders, and the #2642 console reads the same fold. Decision record: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

**Guardrail — the fold is written once, never two copies.** There must be exactly ONE fold module (in the WE core, [we:scripts/lib/](scripts/lib/)); the conveyor and the plateau-app console both call it. A second copy of the fold logic in either consumer is a bug. `we:scripts/workflows/review-parked-prs.mjs` already *returns a ledger and nothing else* — evolve it to append events to the durable log, and pipe the shared fold's output into the conveyor loop ([we:scripts/conveyor/](scripts/conveyor/), `we:skills-src/conveyor/`) so an operator sees what the jury is, is doing, and has found.

**Size grows accordingly** — bumped 5 → 8: this is no longer an in-memory ledger return but a durable event log plus a shared fold with two consumers. Depends on the convergence loop producing the round-by-round events.

## Reconcile with #2500 (ratified: KEEP #2500)

This story is the durable-ledger successor to #2500's persist path — but it is **not** a second, parallel
ledger. Ratified reconciliation: #2641 **REPLACES** #2500's persist path (the `review-parked-prs` ledger
persistence) while **REUSING #2500's widened `lensVerdicts` shape** (the per-lens verdict map #2500 adds to
the ledger event). Build #2641's durable on-disk event log to carry that same widened `lensVerdicts` shape,
so there is exactly ONE ledger — do not stand up a parallel second ledger alongside #2500. #2500 itself is
left untouched.

## Progress

Delivered (#2641):
- **The ONE shared fold** — `we:scripts/lib/jury-ledger.mjs`: the durable append-only JSONL log (one file per
  review subject under gitignored `.conveyor/jury/`), validate-before-write append, tolerant read, and
  `foldJuryLedger(events)` — the single reconstruction of the live ledger (roster + each juror's charter, derived
  status pending/running/found, findings, verdict, round) that BOTH the conveyor and the #2642 console call. Reuses
  #2654's pure event vocabulary + `validateJuryEvent`; reconstructs #2500's widened `lensVerdicts` shape by
  diversity-selection. No second parallel ledger.
- **Conveyor live tree** — `we:scripts/conveyor/jury-tree.mjs`: a `/workflows`-style text tree renderer + on-demand
  CLI that calls the shared fold and only formats (no re-implemented fold). Documented in the conveyor skill.
- **review-parked-prs evolved** — `we:scripts/workflows/review-parked-prs.mjs` appends events to the durable log
  per PR via a recorder agent that shells `jury-ledger record` (the CLI builds the events from the converged state
  through the tested `buildReviewLedgerEvents`); best-effort, non-gating, no GitHub side effect (INVARIANT 2 intact).
- `disposition-judge.reduceLedger` left as the pre-existing disposition PROJECTION (a different question over the
  same log) with a reciprocal cross-ref note to keep the shared reduction rules in step.
- Unit-tested (`we:scripts/lib/__tests__/jury-ledger.test.mjs`,
  `we:scripts/conveyor/__tests__/jury-tree.test.mjs`); `check:standards` green.
