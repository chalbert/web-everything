---
title: "Prepare #2981 — can judgment work split into a delegated-draft half + inline-call half?"
date: 2026-08-16
---

# Prepare #2981 — can judgment work split into a delegated-draft half + inline-call half?

Prior-art dig + fork authoring for [backlog #2981](/backlog/2981-can-judgment-work-split-into-a-delegated-draft-half-and-an-i/), toward "ready to ratify."

## What was already on the record

PR #1075 ("delegate-by-default") originally shipped a rule splitting **all** judgment-shaped work
(`decision`/`slice`/`prepare`) into a delegated "work" half (an Opus sub-agent surveys prior art and
drafts the fork's options) and an inline "call" half (the loop rules on it). It was carved back out
before merge (`d14554a6`, "Carve #1075 back to the rename + inversion it started as") after two
independent `security`-lens jurors, in separate `/converge` rounds, found it broken on two axes:

1. **Row 2 cannot ground it.** `we:docs/agent/backlog-workflow.md` row 2 requires the loop to ground its
   verdict by "opening the artifact it rules on… not only a sub-agent's account of it," because "a
   summary cannot show what it left out." For a decision/slice/prepare, the artifact under verdict
   **is** the sub-agent's own writeup — exactly what row 2 disqualifies as evidence.
2. **The blast-radius axis was dropped.** The old Sonnet-execution gate required bounded blast radius
   specifically to guarantee the ruler had context; the rewrite kept "who rules" but dropped that
   guarantee, so the highest-blast-radius judgment class would get a verdict formed on draft text alone.

The shipped state today (`we:docs/agent/backlog-workflow.md:489`) explicitly notes this is "a real
question… but row 2 cannot ground it… Carved out to its own item rather than settled here" — i.e. #2981.

## The skeptic pass (throwaway sub-agent, four axes)

Attacked a drafted "sanctioned exception" default (split only for small, single-fork, non-shared-gate
judgment work, gated behind (i) an explicit read carve-out re-opening the draft's cited `file:line` refs
and (ii) binding `check:health` G4/D1 as a pre-ratification run):

- **Classification — survives-with-amendment.** `:489` and `:506` already lean toward "keep inline" as
  precedent, not open ground; the real open question is narrower than the drafted fork admitted.
- **Merit — REFUTED.** The "read carve-out" re-verifies what a draft *cited*; the juror objection was
  about what a draft *silently omitted*. `:506`'s absence-claim rule ("spot-verify cannot reach it… no
  size escape") already forecloses exactly this fix — it's a presence-check dressed as an omission-check.
- **Statute-overlap — real collision found.** `:499-500`'s Sonnet rung already excludes judgment-shaped
  work from any blast-radius exception "however small… it looks" — the drafted default reintroduces
  precisely the exception that clause forecloses, with no cross-reference reconciling the two.
- **Citation-scope — REFUTED.** Citing row 4's spot-verify (a single load-bearing claim, about to be
  acted on) as authority for a comprehensive re-verification of an entire drafted position is the same
  shape as the #1913 miss — a narrow-scope rule cited past its authoring reach.

Default flipped from the drafted "sanctioned exception" to **keep judgment fully inline**, grounded in
the structural (not merely resourcing) limit `:506` already states.

## The two-confusion screen (fresh-context sub-agent)

- **Q1 (impl-detail leak) — clear.** Execution routing changes what backs the ruling's correctness, an
  externally-relevant stake even though the routing itself is invisible outside the session.
- **Q2 (merit vs. prioritization) — flagged: prio**, under a "both branches free to build, instantly
  correct" hypothetical. That hypothetical stipulates away the disputed omission-verification limit
  itself (assumes the delegate "never omits anything"), which trivially erases any question about
  handling omissions — it doesn't test the actual crux. The fork's rationale was rewritten to lead with
  the **structural** limit (`:506`: a completeness/negative claim isn't spot-verifiable at any budget),
  with token cost demoted to a secondary, already-settled consideration (the standing asymmetry bias:
  "when torn, go up").

## Outcome

Fork 1 authored with (a) keep fully inline (recommended default, re-grounded on the structural absence
gap) / (b) named bounded-exception draft, shown non-viable as specified / (c) general split, already
precedent-excluded. Stamped `preparedDate`; status stays `open` for a human ratification turn.
