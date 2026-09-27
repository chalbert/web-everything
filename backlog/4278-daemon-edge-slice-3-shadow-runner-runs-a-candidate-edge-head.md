---
bornAs: xkyto3n
kind: story
size: 8
parent: "4276"
status: open
blockedBy: ["4277"]
scope: ["we:scripts/lib/daemon-edge-shadow.mjs", "we:scripts/lib/daemon-rebuild.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# daemon-edge slice 3: shadow runner runs a candidate edge head for 2-3 real ticks in dry-run and diffs its plans against the live daemon

Before any daemon adopts a new daemon-edge head, run it beside the live daemon for 2-3 real ticks in DRY-RUN (reconcile plan, dispatch plan, drain plan) and diff the plans. Flag divergences: refuses everything, dispatches nothing, more than N new dispatches. Clean shadow marks the head shadowed; a flagged one is held with an alert. Reuse the existing dry-run passes and we:scripts/lib/daemon-live-smoke.mjs.

## Done when

1. **Executable** — a test where a candidate edge head whose dispatch plan is empty (vs a live plan with work),
   one that refuses every item, and one with more than N new dispatches are each flagged and NOT marked shadowed;
   an equivalent head is marked shadowed after the configured 2–3 ticks.

## Scope

- Materialize the candidate head in a disposable worktree (reuse `we:scripts/lib/daemon-rebuild.mjs#materializeCandidate`).
- Each shadow tick runs the reconcile / dispatch / drain passes in dry-run from the candidate and from the live
  clone, on the same inputs, and diffs the plans.
- Divergence rules: refuses-everything, dispatches-nothing, >N new dispatches (N configurable). Record per edge
  head: `shadowed` or `shadow-flagged` with the diff.
- Flag-gated by `WE_DAEMON_EDGE`.
