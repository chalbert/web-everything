---
kind: decision
status: resolved
dateOpened: "2026-08-02"
dateResolved: "2026-08-02"
preparedDate: "2026-08-02"
ratifiedBy: "Nicolas Gilbert (operator)"
dateRatified: "2026-08-02"
codifiedIn: docs/agent/platform-decisions.md#orchestrator-stops-line-never-absorbs
tags: [conveyor, governance, stop-the-line, review, convergence, mechanization]
---

# Stop-the-line conveyor governance — the orchestrator never absorbs a non-mechanical case

The conveyor orchestrator (the main session) is a **mechanical conveyor**, not smart glue. When a case
exceeds the mechanic, the orchestrator must NOT quietly do the case itself to keep delivery moving — that
hides the gap and perpetuates manual operation. It **stops the line**, files the gap, and the class is
mechanized (or routed to a human) before flow resumes. This decision codifies one coherent
"mechanical-conveyor governance" cluster: what a stop-the-line is, when a human is genuinely required
(judgment, not convergent review), how the mechanical fix↔review convergence loop clears review, and when
a deterministic oracle — not a person — clears a slice.

## Ruling (2026-08-02) — RATIFIED by the operator (Nicolas Gilbert)

The operator (Nicolas Gilbert) ratified this governance cluster in-session on **2026-08-02**. It is
policy-tier / statute: it edits the cite-able statute layer (`we:docs/agent/platform-decisions.md`), so it
lands held for human review — the genuine ratification a `review:human` gate exists for.

The ruling codifies four cross-linked statute anchors (each carries a `**Ratified 2026-08-02 by the operator
(Nicolas Gilbert)**` provenance line pointing back at this decision):

1. `#orchestrator-stops-line-never-absorbs` — **Stop-the-line (Andon).** The orchestrator never absorbs a
   non-mechanical case as "smart glue"; it HALTS the delivery, FILES the gap, and the class is mechanized or
   routed to a human before it flows again.
2. `#human-required-is-judgment-only` — **Human-required means judgment, not convergent review.** A human gate
   is reserved for genuine judgment (ratifying new policy/statute; novel design forks). Convergent fix/review
   is mechanical and runs as the fix↔review convergence loop.
3. `#fix-review-convergence-independent-root-cause` — **Fix↔review convergence loop.** The mechanical clearer
   for `review:pending` and non-judgment gate-self PRs: an architecturally independent reviewer, every round
   diagnosing and addressing root cause (#2823), escalating to a human only on non-convergence or a
   genuine-judgment finding.
4. `#deterministic-oracle-clears-slice` — **A deterministic oracle clears its slice, not a human.** A green
   acceptance oracle mechanically clears the slice; `human-verify` applies only until that oracle exists.

**Provenance:** the anchor bodies carry the rationale, prior art, and cross-links. Lineage below.

**Lineage:** composes `we:docs/agent/platform-decisions.md#agent-convergence-independent-validation`
(#2398 — a builder never clears its own diff), the conflict-of-interest / non-author rule (#2439 —
same-orchestrator subagents are not independent), the prevention-introspection review discipline (#2823 —
every review round addresses root cause), and the real-route render-slice conformance oracle (#2811), whose
green state cleared the console-board remediation (#2834).
