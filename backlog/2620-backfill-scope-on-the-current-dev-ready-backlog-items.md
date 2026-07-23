---
bornAs: xgntiy7
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, readiness, scope, backfill]
---

# Backfill scope on the current dev-ready backlog items

Author `scope:` frontmatter on the existing dev-ready backlog items so the conveyor has real scope-bearing,
parallelizable work to dispatch — instead of holding everything `needs-probe` and auto-preparing it before any
build. This is the one-time catch-up for the readiness-flow authoring built in #2619: the flow writes
`scope:` for *new* items going forward; this backfills the *current* ready pool.

## What to build

- Run the touch-set probe over the current dev-ready items (`status: open`, unblocked, agent-buildable) and
  write a coarse, prefix-shaped `scope:` onto each, human-reviewed per the card-mutation guard (#2302).
- Keep prefixes coarse (a directory prefix, not every file) — `we:scripts/readiness/dispatch-plan.mjs` (#2609)
  does a prefix-aware overlap check.
- Outcome: the dispatcher can fan out disjoint items across the lane pool immediately, instead of every item
  routing through auto-prepare first because it is `needs-probe`.

Instance of [state lives where its nature dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
(#2617) — durable readiness authored upstream, script-read forever.
