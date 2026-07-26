---
bornAs: x4ttbgl
kind: epic
parent: "2612"
status: open
dateOpened: "2026-07-26"
relatedTo: ["2607", "2609"]
tags: [conveyor, orchestration, throughput, delivery, mechanics, epic]
---

# Conveyor orchestration: mechanize the core + delegate to per-lane orchestrators

Today ONE main session orchestrates the whole conveyor serially — dispatch, watch, auto-review, ghost-lane release, and tick — which is both a context and a throughput bottleneck. Operator direction (2026-07-26): (a) MECHANIZE the deterministic orchestration into a state machine, not an AI-in-the-loop conductor, and (b) DELEGATE per-lane orchestration to a delegated agent, so the main session does almost nothing but genuine judgment and operator conversation. This epic carries the slices that move the conveyor from a single serial conductor to a deterministic core plus per-lane orchestrators.

## The bottleneck today

The conveyor skill (#2612) runs from a live main session: it dispatches scope-disjoint items into the lane pool, watches their PRs, auto-reviews escalations, releases ghost lanes, and ticks on a chained sleep — all serially, in one session's context. Every one of those is a wait the operator's single session pays for, and the session's context fills with mechanical bookkeeping that is not judgment. That is the throughput and context ceiling this epic exists to lift.

## Operator direction (2026-07-26)

- **(a) MECHANIZE more — the deterministic orchestration becomes deterministic mechanics.** Dispatch, watch, release, tick, and health are all script-decidable. They should live as a deterministic, tested state machine — the thin-by-construction deterministic core — not as an AI-in-the-loop conductor re-deriving the plan each tick. This is the same line drawn by [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment) (#2607), applied to the conveyor's own orchestration. **When this becomes the UI product there is NO central session — only the mechanics run.**
- **(b) DELEGATE — few things need the MAIN session.** Each LANE should have its own central orchestrator: a delegated per-lane agent driving that mechanical core for its lane. The main session then does almost nothing but genuine judgment (escalation review, forks) plus the operator conversation. Orchestration moves off the single serial session and out to the lanes.

## Relationships

- **Parent #2612** — the conveyor skill (interim main-session lane operator) this epic re-shapes.
- **#2607** — deterministic-core / thin-judgment: the statute this MECHANIZE half enacts for the conveyor's orchestration.
- **#2609** — the dispatch-plan script (`we:scripts/readiness/dispatch-plan.mjs`) + `scope:` field: the first deterministic orchestration primitive; the mechanized core extends this seam rather than re-deriving dispatch in prose.
- The **per-item-overhead** work — the same throughput program's effort to cut the fixed cost each item pays; delegating per-lane orchestration is the structural version of that reduction.

## Key design fork (resolve later, not here)

**How much of orchestration is pure mechanics vs. a per-lane agent?** The two halves push opposite ways: (a) wants as much as possible in a deterministic state machine (reproducible, testable, product-ready with no session); (b) wants a per-lane orchestrator with enough autonomy to run its lane. The line between "the mechanics decide it" and "the per-lane agent decides it" is the central open call — resolve it as a decision item before the delegate slice, so the per-lane brief is written against a settled boundary.

## Likely slices

- Extract the deterministic **tick / dispatch / watch / release / health** core into a tested state machine (the mechanized core; builds on #2609).
- A **per-lane orchestrator brief** — the delegated agent that drives the mechanical core for one lane (blocked on the fork above).
- **Retire the main-session serial loop** — once mechanics + per-lane orchestrators cover it, the main session drops to judgment + operator conversation only.
