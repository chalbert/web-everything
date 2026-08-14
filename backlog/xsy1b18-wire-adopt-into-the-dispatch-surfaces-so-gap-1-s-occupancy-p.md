---
kind: task
status: open
dateOpened: "2026-08-14"
tags: [conveyor, lane-pool, guards, footgun]
scope:
  - we:skills-src/conveyor/delivery-agent-brief.md
  - we:scripts/operations/dispatch-lane.mjs
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:docs/agent/delivery-loop.md
---

# Wire `--adopt` into the dispatch surfaces so Gap 1's occupancy protection isn't dormant

Found during [#1234]'s round-2 independent review (2026-08-14). [#2997] r2 fixed Gap 1's false-DENY by making
occupancy a DECLARED signal (`workerSession`, set via `acquire --adopt` or `we:scripts/lane-pool.mjs adopt`)
rather than inferred from `ownerSession`. Correct fix — but verified against the real pipeline, **nothing
in-repo calls it**: not the conveyor delivery brief (`we:skills-src/conveyor/delivery-agent-brief.md:42`,
which self-acquires with no `--adopt` despite being the exact self-acquisition topology `--adopt` was built
for), not `we:scripts/operations/dispatch-lane.mjs` / `we:scripts/operations/dispatch-lane-io.mjs`, not
`we:docs/agent/delivery-loop.md`'s acquire example.

So Gap 1's protection exists, is correctly designed, and is **inert** — a lane-clobber of the exact shape
[#2997] was filed to stop (a co-resident session editing into a lane it does not hold) is still unrefused in
practice today, not because the fix is wrong but because nothing opts into it.

## What to do

Add `--adopt` to the conveyor delivery brief's self-acquire step
(`we:skills-src/conveyor/delivery-agent-brief.md:42`). In that topology the same agent runs `acquire` and
does the edits, so `workerSession` is stamped from the very env the `Edit`/`Write` hook later reads — no
false-deny channel opens. Check whether `we:scripts/operations/dispatch-lane.mjs` /
`we:scripts/operations/dispatch-lane-io.mjs`'s dispatcher-hands-lane-to-worker topology needs the
`we:scripts/lane-pool.mjs adopt` hand-off call added at the worker's start instead (the two-actor case
`--adopt` was built for), and update `we:docs/agent/delivery-loop.md`'s acquire example either way so a
reader copying it gets a protected lane by default.

## Done when

- [ ] The conveyor delivery brief's self-acquire passes `--adopt` (or the equivalent), verified by re-running
      the round-2 reviewer's own check: does anything in-repo now call `adopt`/`acquire --adopt`?
- [ ] One real dispatched lane, worked end-to-end, demonstrates a sibling's `Edit`/`Write` into it is refused
      — the shape [#2997]'s Gap 1 was filed to close, now actually closed in the pipeline, not only in tests.
- [ ] `we:docs/agent/delivery-loop.md`'s acquire example reflects whichever surface(s) were wired.

## Watch for

- `--adopt` degrades to a no-op when `CLAUDE_CODE_SESSION_ID` is absent (adopted = null) — confirm this stays
  true for whichever surface gets wired, so a caller with no session id sees today's unchanged behavior
  rather than a new failure mode.
