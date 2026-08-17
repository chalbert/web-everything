---
kind: story
size: 2
status: open
relatedTo: ["2972"]
scope: ["we:scripts/operations/gate-health.mjs", "we:scripts/conveyor/"]
dateOpened: "2026-08-17"
tags: [operations, conveyor, permissions, observability]
---

# Surface stuck background-agent permission prompts to the orchestrator

An unattended `dispatch-lane`/`conveyor` agent that hits a permission prompt its `we:.claude/settings.json`
allow-list doesn't cover has no way to answer it — nobody is watching. It sits in the daemon's roster
forever with `status: "waiting"`, `waitingFor: "permission prompt"`, `state: "blocked"`, burning a lane
lease and never producing a PR or an error. Nothing in the conveyor/gate-health path currently reads
that state, so the orchestrator has no signal a dispatch died this way — the only way to find out today
is to run `claude agents --json` by hand and eyeball it.

## Why this is a real gap, not a nicety

Observed live on 2026-08-17: two separate `dispatch-lane` dispatches for backlog #2972 (one from the
original run, one from a stale-record-triggered re-dispatch) both landed in this exact state,
undetected for hours, each holding a lane lease the whole time. The item only actually shipped through
an unrelated `2972`-labeled Agent-tool background session that happened to be running in parallel. Had
that session not existed, #2972 would have silently stalled indefinitely — same failure class as the
silent Agent-tool dispatch failures #2972 hit earlier in its own history, just one layer deeper (the
mechanized `dispatch-lane` operation isn't immune to it either).

This item's counterpart on the config side (widen the allow-list itself so fewer dispatches hit this in
the first place) landed as we#1418; this item is the runtime detection that doesn't replace — even a
well-widened allow-list can't cover every path an agent might touch, so detection has to exist
regardless.

## Shape

`claude agents --json` already reports `status`/`waitingFor`/`state` per background session — this is a
polling problem, not a missing-primitive problem. Extend `we:scripts/operations/gate-health.mjs` (or
`dispatch-lane`'s own liveness check, alongside its existing aged-out-run-record detection) to
cross-reference dispatched `sessionSlug`s against that list, and flag any session sitting in
`blocked`/`waiting: permission prompt` past a short threshold (e.g. 5-10 minutes — long enough to not
false-positive on a legitimately slow tool call, short enough to catch this well before a multi-hour
silent stall) as an actionable finding, surfaced the same way aged-out dispatch records already are
today.

## Done when

1. **Executable** — a test that spawns (or fakes) a `claude agents --json` entry in `blocked`/`waiting:
   permission prompt` state for a dispatched sessionSlug, runs the extended health check, and asserts it
   surfaces as a finding; the same fixture in a healthy (`working`/no entry) state asserts no finding.
