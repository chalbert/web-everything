---
bornAs: xvwmwkx
kind: story
size: 5
parent: "2649"
status: open
scope: ["we:skills-src/", "we:scripts/lib/"]
dateOpened: "2026-07-26"
tags: []
---

# Self-driving convergence loop for the subject-jury (wire deriveNegotiationOutcome + round cap)

Make the subject-jury **self-drive its convergence loop** so a human doesn't hand-run round after round and
hand-judge when to stop. The deterministic controller already exists — `deriveNegotiationOutcome` +
`NEGOTIATION_ROUND_CAP` in `we:scripts/lib/jury-core.mjs` (built for the drain's negotiated review, #2311/#2285):
a pure function `{verdict, round} → continue | escalate` (`changes` & round<cap → continue; `needs-human` or
round≥cap → escalate). But the subject-jury harness (`we:skills-src/jury/subject-jury.workflow.js`) is **one-shot**
— it runs a single panel and returns, with the loop "deferred" — so today a human replays `/jury`, folds findings
by hand, and eyeballs continue-vs-escalate. That hand-driving is a **mechanical decision done by judgment**, which
is exactly the deterministic-core / thin-judgment inversion the constellation forbids (rule #51). Wire the existing
controller in so the loop runs itself.

## Why (a corrected process, not a preference)

Observed 2026-07-26 driving a design through the jury by hand: the operator had to correct the loop **twice** — to
keep going instead of stopping early, and on when "stuck" means escalate. Both are `deriveNegotiationOutcome`'s job,
not a human's. A repeated human correction of a *process* is the signal to **mechanize the process**, not to comply
more carefully. Prefer the mechanical solution: the round-cap controller already single-sources the exact
continue/escalate call.

## What to build

- **Loop the harness** (`we:skills-src/jury/subject-jury.workflow.js`): panel → reduce → if verdict is `changes`
  and `round < roundCap`, run **one bounded editor agent** that folds the round's findings into a revised subject,
  then re-run the panel on the revision; repeat. The continue/escalate branch is **not** the harness's judgment —
  it calls `deriveNegotiationOutcome({verdict, round, roundCap})` every round (single-sourced, never re-decided
  per caller).
- **Escalate mechanically**: on `needs-human` (any round) or `changes` at `round ≥ roundCap`, stop and emit an
  **escalation packet** (round history + the surviving findings) to the human — the only place a human enters.
- **Deterministic-core / thin-judgment split**, made explicit: MECHANICAL = round accounting, verdict routing,
  the continue/escalate decision, the escalation packet. AI (irreducible) = the jurors' verdicts and the **fold**
  (the editor agent revising the subject). Nothing about *when to continue or escalate* is a model call.
- **Optional refinement (not required):** an early-stuck signal — if a folded finding **recurs** by signature in a
  later round (the fold didn't take), escalate before the cap. Keep it simple first; the round cap alone already
  satisfies "escalate only if stuck (= didn't converge in N rounds)."

## Definition of done

- Running `/jury` on a subject that returns `changes` **loops on its own** to `accept`, or escalates on the
  mechanical signal — with no human deciding continue-vs-escalate mid-loop.
- The continue/escalate decision is `deriveNegotiationOutcome` verbatim (asserted by test), not re-implemented.
- Complements #2663 (harness hardening) and #2664 (meta literal); generalizes the resolved #2311 drain loop to the
  subject-agnostic front door. Lineage: epic #2649, the deferred loop noted in the harness header (#2285).
