---
bornAs: xynt0jj
kind: story
size: 5
parent: "3029"
status: open
blockedBy: ["3032", "3030"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
  - we:scripts/conveyor/
scopeRationale: "Adds one declaration file and reads the existing conveyor tick core; the declaration filename does not exist yet."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Declare dispatch — the effect that starts rather than completes

The real test of the four-kind vocabulary. Dispatching a lane reads the queue, the leases and the free slots —
all `compute`, all already scripted — and then its effect **launches an agent that outlives the run by an hour**.

Nothing in `compute` / `judge` / `confirm` / `effect` describes an effect that *begins* rather than *finishes*.
Every other declared operation's effects are applied and done; this one hands off.

## Gated on the spike

`blockedBy` [#3030] deliberately. That two-point spike establishes whether the command-line background-agent
lifecycle already owns start / observe / stop, and its answer changes what gets built here:

- **Lifecycle covers it** → the effect is "start a background agent, record the handle", the run completes
  normally, and the engine never models a long-running child. No new kind.
- **Covers start only** → a thin adapter supplies observation and stop. Still no new kind.
- **Does not fit** → the vocabulary has a genuine hole, and per
  [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
  that is a signal the *model* is wrong. Extending to a fifth kind would then be its own decision, argued in the
  open, not a quiet addition inside this slice.

**Do not start this slice before the spike reports.** Building it blind is how a fifth kind gets added by
accident.

## What it must not disturb

Dispatch is the conveyor's own machinery, and the mechanical tick core already exists and is tested. This slice
declares the operation **over** that core; it does not re-derive dispatch policy, and it puts no model in the
per-lane loop — [#conveyor-orchestration-mechanics-not-per-lane-agent](../docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent)
is untouched. The singleton runner lock stays exactly where it is.

## Acceptance

A lane is dispatched through the declared operation with the same holds, the same scope-lease arbitration and the
same guard bookkeeping as the current tick, verified against a real queue. The launched agent's handle is
recorded on the run so the conveyor can find it after a restart. If the spike returned answer 3, this slice
instead lands a written case for the missing kind and stops — a deliberate non-delivery is a better outcome than
a silent vocabulary extension.
