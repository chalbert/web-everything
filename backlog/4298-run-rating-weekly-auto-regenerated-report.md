---
bornAs: x8pzmbm
kind: story
size: 3
parent: "4075"
status: open
dateOpened: "2026-09-27"
tags: []
---

# Run rating: weekly auto-regenerated report

Slice (f) of run rating & efficiency (parent #4075). Slice 1 ships `we:scripts/conveyor/run-rating.mjs`'s
`report` subcommand as a pull-based CLI
an operator has to remember to run. This item turns it into a standing weekly artifact: a scheduled job re-runs
the report over the trailing week, publishes it (grade distribution, waste causes, per-demand token table,
week-over-week trend), and refreshes the same page in place rather than accumulating a new one every week.

## Done when

1. **Executable** — a scheduled command regenerates the report artifact from the scorecard store with no
   manual step, verifiable by running it twice against a fixture store and confirming the second run updates
   the same artifact rather than duplicating it.
