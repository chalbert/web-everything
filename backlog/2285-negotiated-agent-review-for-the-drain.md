---
kind: epic
status: open
relatedTo: ["2171", "2262", "2162", "2279"]
tags: [lane, drain, review, merge-queue, multi-agent, agent]
dateOpened: "2026-07-04"
relatedReport: reports/2026-07-05-backlog-split-analysis.md
---

# Negotiated agent review for the drain — auto-review → editor negotiation → mandate panel

The #2171/#2262 review-escalation gate parks a blast-radius PR with `review:pending` and waits for an
independent reviewer to apply `review:accepted`/`review:changes`. Today that reviewer is a human, so an
escalated PR stalls until someone reviews it by hand (observed 2026-07-04: every `ready-to-merge` PR in the
queue parked, drain landed nothing). This epic teaches the drain to run the independent review **itself** via
subagents — while preserving the one invariant the gate exists to protect:

> **The final landed diff must be signed off by an agent that did not author that final diff.**

The human gate is kept ONLY where an agent reviewer has a genuine **conflict of interest** — a change to the
auto-review *trust chain itself* (the code that decides whether the gate fires and what clears it). There, an
auto-reviewer would be policing a change to its own leash, so a human is *essential* — not merely "important".
Everything else in blast-radius is agent-reviewable (a fresh-context adversarial agent is independent of the
*producer*; no self-gate conflict).

Sliced into three stages, each adding one axis, invariant intact at every step:

- **v1 — #2286 (this epic's foundation).** Deterministic `review:human` conflict-of-interest classifier
  (`GATE_SELF_PATHS` = the gate's own decision code) + single-reviewer auto-review in the `/drain` ceremony:
  `accept` → land, else `review:changes` → author lane. No drain-side editing yet. Gates the rest.
- **v2 — #2311 (editor↔reviewer negotiation loop).** "Auto-fix" as a convergence cycle: an editor agent and a
  reviewer agent iterate (propose → critique → revise) until the reviewer accepts. Bounded by an N-round cap;
  non-convergence escalates to `review:human`. The final state is reviewer-approved, so the invariant holds.
- **v3 — #2310 (multi-mandate reviewer panel).** Distinct mandated reviewers (correctness / security /
  simplicity / standards-conformance — the `/code-review` lenses) must **jointly** agree. Unanimous accept →
  land; mandate conflict (security wants X, simplicity wants not-X) or non-convergence → `review:human`, because
  a tradeoff between mandates is human judgment by definition.

Composes onto tools we already have: the **Workflow orchestrator** (deterministic loop-until-agreement,
fan-out reviewers) and `/code-review`'s dimensions (the mandate lenses). v2 (#2311) is `blockedBy` #2286; v3
(#2310) is `blockedBy` #2311. Sliced 2026-07-05 (`relatedReport`).
