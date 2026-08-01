---
kind: story
size: 5
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [plateau-loop, conveyor, console, review, transparency, convergence, slice-uifg-adjacent]
---

# Per-step pipeline transparency — surface convergence rounds and each stage trace

Captured 2026-08-01 (operator direction): *"as much transparency for every step — we could even expose
convergence rounds, and potentially other steps too."* The delivery pipeline already **produces** rich
step-level detail; almost none of it is **surfaced**. A parked PR shows a bare `review:pending` label with no
window into the rounds, votes, or reasons behind it — the opacity that prompted this.

## The principle
Every pipeline stage should emit a **first-class, inspectable trace**, not just a terminal label. The exemplar
is the review/jury **convergence rounds**; the principle generalizes to every step.

## What already exists (surface it, don't rebuild)
- **Jury ledger** ([#2641], resolved) — already records votes, ratings, and **rounds**; the single source of truth for how the committee converged.
- **Convergence loop** ([#2437], resolved) — the panel↔editor↔re-review loop that produces the rounds.
- **Advisory care-level** ([#2563]/[#2567]) — the escalation reasons + care-level dial behind a park/disposition.
- **[#2486]** (open) — "surface the automated review pipeline: per-lens verdicts, disposition" — the closest home, but scoped to the *review* surface.

## Scope
- **Convergence rounds view** — for any reviewed PR, render its ledger: per-round per-lens verdicts, votes/ratings, the disposition, and the escalation reasons + care-level that routed it. Reachable from the PR's board cell / review surface.
- **Generalize to other steps** — expose the trace of each stage a piece of work passes through: build self-review, drain escalation reasons, care-level, land — a per-item step timeline, so "why is this parked / why did this land" is always inspectable, never opaque.
- **Consistency** — one trace grammar across stages (a step = {name, inputs, rounds?, verdict, reasons, actor, timestamp}); reuse the ratified card/token grammar.

## Relation
Extends [#2486] beyond the review surface to the whole pipeline. Adjacent to the UI-Fidelity Gate ([#2804]),
whose own gate steps (contract check, real-route render, conformance) should emit the same kind of trace.

## Acceptance
From a board cell / PR, an operator can open the **convergence rounds** of its review (rounds, votes,
disposition, escalation reasons) and a **per-step timeline** of the stages it passed through — sourced from the
existing ledgers, not a parallel store. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
