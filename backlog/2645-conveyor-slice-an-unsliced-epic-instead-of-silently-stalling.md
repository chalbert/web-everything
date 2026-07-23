---
bornAs: x254bqo
kind: story
size: 5
parent: "2612"
status: resolved
scope: ["we:scripts/readiness/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: []
---

# Conveyor: slice an unsliced epic instead of silently stalling it

Today a cleared **epic** is not buildable, so a cleared epic just sits `cleared-but-not-ready`: the conveyor silently never dispatches it AND never slices it. This item makes the conveyor slice an unsliced epic instead of stalling it.

## Problem

Readiness classifies `kind:epic` as a `/slice` candidate, not as agent-ready. In [we:scripts/readiness/engine.mjs](scripts/readiness/engine.mjs) epics are excluded from the agent-ready set — agent-ready is `task | story≤8`. So when an epic clears its blockers it can never be dispatched, and nothing routes it to slicing either. It falls into a silent hole: not built, not sliced, no signal.

## Proposed behavior

Add explicit epic handling at dispatch:

- Detect a cleared epic when the dispatcher considers it, and hold it in a `needs-slice` state (a first-class dispatch outcome, not a silent skip).
- Either surface it for a human `/slice`, or auto-run the split-backlog-item / slice flow to produce buildable child stories, then dispatch those children.
- Never silently stall an epic — a cleared epic must always end up either sliced-and-dispatched or explicitly surfaced as awaiting slice.

The rule: a cleared epic is a slice trigger, not a dead end.

## Progress

Done. Epic handling is now a first-class dispatch outcome:

- **Dispatcher (`we:scripts/readiness/dispatch-plan.mjs`)** — the pure core holds any cleared `kind:epic` as
  `needs-slice`, checked BEFORE the scope gate so a (near-always scope-less) epic is never mislabeled
  `unshaped-no-scope` and auto-prepared (which would aim a build agent at a container). `blocked` still takes
  precedence (a blocked epic can't be sliced yet). Added `needs-slice` to `HELD_REASONS` + a `NEEDS_SLICE_HINT`
  gloss; the IO shell enriches each queue row with `kind` from the loader.
- **Tick state (`we:scripts/readiness/conveyor-state.mjs`)** — `shapeQueue` carries `kind`/`epicState`; new
  `deriveNeedsSlice` surfaces the armed epic rows as `state.needsSlice` (each `{ num, epicState }`), mirroring
  `deriveUnshaped`. The IO shell enriches `kind`/`epicState` best-effort (a load miss degrades safely to
  non-epic).
- **Skill (`we:skills-src/conveyor/SKILL.md`)** — new §3d: each tick SURFACES every `state.needsSlice` epic for
  `/slice` (routed by `epicState`: `unsliced`→/slice, `done`→/resolve, `tracking`/`program`/`parked`→no slice).
  Chose SURFACE over auto-slice (the `/slice` flow is human-gated per split-backlog-item) — the spec's
  "surface OR auto-run" gives the choice; auto-slicing without a human is out of scope. No agent, no lane, no
  guard — a standing "awaiting slice" signal.
- **Tests** — dispatch-plan: 5 new cases (scope-less epic, scoped epic, blocked>needs-slice precedence, disjoint
  story still launches, non-epic passes through). conveyor-state: `deriveNeedsSlice` block + updated shape
  assertions. Full readiness suite green (479 tests); `check:standards` green (0 errors).
