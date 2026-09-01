---
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
---

# Wire reconcile-pass's kind:'fix' dispatch into the runner's mechanical passes

Found live 2026-09-01 during #3383's own runner-tick-loop live-fire test. `we:scripts/conveyor/reconcile-pass.mjs`
already plans a `kind: 'fix'` entry for a `review:changes`-bounced PR with nothing live working it (confirmed:
it correctly planned one for a real bounced PR, `#1764`, during tonight's run). But
`we:skills-src/conveyor/runner.mjs`'s mechanical-pass wiring (added for `#3383`, landed via `PR #1758`'s
sibling work) only consumes `plan.dispatch` entries where `kind === 'review'` — a `kind: 'fix'` entry is
silently dropped, never dispatched anywhere. Separately, tick-core's own older `planFixSpawns`/`spawnFixes`
mechanism (driven from `state.prs`) also never fired for the same bounced PR across 5+ real ticks tonight, so
neither path actually gets a fix agent onto a bounced PR opened outside the runner's own build dispatch. Net
effect: "the review step is fully mechanized" (claimed in this epic's own 2026-08-31 session update) is true
only for the FIRST review — a `review:changes` verdict currently has no automatic path back to a fix, which
undercuts this epic's own "Done when" #1 (a full fix → review → land cycle with zero interactive turns).

## Done when

1. **Executable** — a live (or faithfully reproduced) `review:changes` PR with no live session working it,
   fed through one `we:skills-src/conveyor/runner.mjs` tick, results in an actual `dispatch-lane` fix spawn
   (or the reconcile-pass `kind:'fix'` entry is otherwise proven to reach a real dispatch) — not just a
   silently-dropped plan entry. A regression test pinning this (mirroring the `kind === 'review'` wiring's own
   test coverage) is the executable proof.
2. Investigate and resolve whether tick-core's own `planFixSpawns` is meant to be the ONE mechanism for this
   (in which case reconcile-pass's `kind:'fix'` planning is redundant/dead and should say so, or be removed)
   or whether both are meant to cover different cases (in which case both need to actually fire) — don't leave
   two parallel, both-silently-inert mechanisms in place.
