---
kind: epic
parent: "2445"
status: open
dateOpened: "2026-07-16"
tags: [plateau-loop, build-queue, prioritization, console]
---

# Plateau Loop — autonomous AI build queue

The coordinator's operable, prioritized autonomous builder: a user-driven prioritization system feeds a supervised `claude` agent that builds ready backlog items one at a time, from the console. Greenlit 2026-07-16 as the program the reframed `we:backlog/2525-backlog-view-launch-control-claim-handoff-vs-headless-build-.md` "build" call graduates into, built on the ratified prioritization design `we:backlog/2526-plateau-build-queue-prioritization-system-design-forks.md`. This is the real "manage AI builds from the UI" capability — the launch button (#2522) falls out of it as the build-now / add-to-queue control.

## The shape (from the #2526 ruling)

A **fixed skeleton + a configurable scoring engine**, with prioritization strictly **downstream of readiness** (it orders the queue, never mutates `blockedBy`/readiness):

1. **Prioritization data model + engine** (WE) — the queue's ordering: a coarse `tier` + a between-able `rank` (LexoRank) + a WSJF-shaped weighted `score` engine + a hard readiness gate + aging, with the deterministic `next-to-build` computation and a versioned config object. Buildable now — no runner dependency.
2. **Prioritization / queue UI** (console) — tier pins, drag-to-rank, the weights-config panel, and the ordered build-queue view. Surfaces slice 1.
3. **Agent-runner** — the `claude -p` spawn/steer/stop contract. This **un-parks the deferred decision [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/)**: greenlighting the program *is* the consumer #2444 was waiting for. Prepare + ratify #2444, then build the runner.
4. **Build endpoint + supervised builder** (console) — `POST /api/backlog/build` pulls `next-to-build` and runs the agent at WIP=1, non-preemptive; the row shows in-flight → PR. Needs the runner (3) + the queue (1).
5. **The launch/build control** ([#2522](/backlog/2522-backlog-view-launch-work-on-an-item-from-the-ui/)) — the console control that builds-now / adds-to-queue, subsumed into this program.

## Order

Slice 1 is unblocked and starts now. 2 rides on 1. 3 (#2444) is a decision to prepare+ratify, then build; 4 needs 3 + 1; 5 (#2522) needs 4. The prioritization half (1 → 2) delivers a usable, orderable queue even before the autonomous builder exists.
