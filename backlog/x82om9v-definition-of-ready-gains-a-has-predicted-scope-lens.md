---
kind: story
size: 2
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, readiness, scope, lens]
---

# Definition-of-Ready gains a has-predicted-scope lens

Surface a readiness lens / check that flags ready items missing a predicted `scope:`, so "has predicted scope"
becomes a **visible** part of Definition of Ready — a dev-ready item without `scope:` reads as *not fully
shaped* (the dispatcher can only run it on the serial floor).

## What to build

- A `/backlog` readiness lens (or a `check:readiness` note) that marks a `status: open`, unblocked item as
  missing its predicted touch-set when `scope:` is absent/empty — the same `needs-probe` condition
  `we:scripts/readiness/dispatch-plan.mjs` (#2609) holds on.
- It is a *surfacing* lens, not a hard gate: an unscoped item is `needs-probe` / unshaped, not blocked (per the
  #663 refinement in [state lives where its nature dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)).

**Optional / may fold into #xbzk108** if the readiness-flow authoring already surfaces the missing-scope signal
cleanly — file separately only if the lens is a distinct surface.
