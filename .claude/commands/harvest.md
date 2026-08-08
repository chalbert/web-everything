---
description: Harvest the cross-session learnings pool — dedup, red-team what recurs, route survivors to backlog/memory via lane → PR (routes to the harvest-learnings skill)
---

Invoke the `harvest-learnings` skill. This is the **only** place learnings are judged — sessions merely
collect (`we:scripts/conveyor/learnings-drop.mjs`), the harvest adjudicates over the whole pool.

Start with the pool read (`npm run harvest -- --json`); an **empty pool is the common, correct outcome** —
say so and stop. Otherwise: red-team each candidate (default REJECT), route survivors (fix/owner →
`we:backlog/`, reusable principle → agent memory) via the normal lane → PR, then archive **only** what you
actually acted on.

`$ARGUMENTS` may carry `--min-sessions=N` to raise the recurrence floor (harvest only what several distinct
sessions independently hit) or `status` to just report pool depth and age.
