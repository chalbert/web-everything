---
bornAs: xzbzc7n
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-09"
dateResolved: "2026-08-09"
scope:
  - we:scripts/operations/
scopeRationale: "The engine is a new directory authored whole by this slice; there are no pre-existing files to enumerate and no sibling item writes there."
tags: [plateau-loop, delivery, operations, engine]
---

# Operation registry and run engine over four step kinds

The foundation everything else in [#3029] sits on: a registry of declared operations, and an engine that
advances one run through its steps. Nothing is declared onto it in this slice — that is [#3035] — so this lands
with the engine plus its unit tests and no caller yet.

## Build

- **A declaration shape.** `op(name, { input, ...steps })` — an input schema and an ordered set of named steps,
  each of exactly one kind.
- **Four step kinds, and no fifth.** `compute` (a pure function plus its declared reads), `judge` (returns a
  mandate + input + shape for the helper in [#3028] to run), `confirm` (suspends the run and records what is
  being asked and of whom), `effect` (returns a list of declared effects; performs none of them).
- **The run record.** `{ id, op, input, cursor, findings, verdict, effects }`, persisted as a local file **behind
  a store module** — a pure core plus a thin io shell, the same discipline `we:scripts/conveyor/queue-store.mjs`
  already uses, so the #2626 product-tier migration is one swap and not a rewrite.
- **`advance(run)`** — steps the machine once and returns the next state. Suspending at a `confirm` and resuming
  with a decision are both just calls to it, which is what lets a run cross surfaces.
- **The effect executor** — applies declared effects keyed by `(runId, stepIndex)`, so re-running after a partial
  failure is safe and no caller has to hand-order two non-atomic writes.

## Acceptance

A fixture operation exercising all four kinds runs to completion, suspends correctly at its `confirm`, resumes
from a rehydrated run record, and re-applies its effects idempotently when replayed. Unit tests cover the engine
without spawning a process or touching the network — the pure core is testable on its own, the io shell is thin.

## Not in scope

Any real operation, any adapter, the judge helper. This slice is the machine; the rest of the epic is what runs
on it.
