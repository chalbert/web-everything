---
kind: story
size: 5
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, readiness, scope, prepare]
---

# Author predicted scope in the readiness flow

Make `/prepare` (and `/scaffold` / `/split`) predict and write an item's `scope:` frontmatter as part of
Definition of Ready, so the human sees the predicted touch-set **before** the item is cleared for build. This
is the upstream-authoring half of the ruling [state lives where its nature
dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates) (#x11yunv): scope is
durable readiness, produced once at shape time by a probe agent's judgment, not by the dispatcher at dispatch
time.

## What to build

- The readiness flow (`/prepare` first, then `/scaffold` and `/split` where an item is shaped) runs the
  touch-set probe and writes a coarse, prefix-shaped `scope:` onto the item — the same field
  `we:scripts/readiness/dispatch-plan.mjs` (#2609) reads to hold overlapping items apart.
- The prediction is surfaced for **human review** before the item is cleared — the reviewer sees the touch-set
  on the card, consistent with the guard-gated card-mutation path (#2302).
- Keep it judgment-in / script-read: the probe (judgment) writes `scope:` once; the dispatcher (deterministic)
  only consumes it, per [#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment).

Without this, every item is `needs-probe` and the conveyor can only run the serial floor — the dispatcher has
nothing scope-bearing to parallelize.
