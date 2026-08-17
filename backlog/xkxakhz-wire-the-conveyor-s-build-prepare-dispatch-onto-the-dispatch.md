---
kind: story
size: 5
parent: "2612"
status: open
relatedTo: ["3037", "3029"]
dateOpened: "2026-08-16"
scope:
  - we:skills-src/conveyor/SKILL.md
tags: [plateau-loop, conveyor, delivery, operations, dispatch]
---

# Wire the conveyor's build/prepare dispatch onto the dispatch-lane operation instead of ad hoc Agent spawns

`we:skills-src/conveyor/SKILL.md` steps 3 and 3b instruct, in prose, exactly the sequence [#3037]'s
`dispatch-lane` operation now mechanizes: call the tick core for the dispatch plan, fill the delivery-agent
brief, and *"Spawn it as one background `Agent`"*. No skill, including conveyor's own, calls the operation
that exists to do exactly this (`grep -rl "dispatch-lane" we:skills-src/` returns nothing).

## The overlap is not superficial

`we:scripts/operations/dispatch-lane-io.mjs`'s own header confirms it: the sink shells the SAME
`we:scripts/conveyor/tick-core.mjs`, reads the SAME `we:skills-src/conveyor/delivery-agent-brief.md`, and is,
in its own words, *"THE ONLY THING IN THIS REPO THAT STARTS AN AGENT"* — through `claude --bg` (a real detached
CLI process, independently pollable via `claude agents --json`, resumable by the waker, backed by a run
record), not the in-session `Agent` tool the skill still names.

## Why this matters more than a style preference

This is a live-fire instance of the second concrete failure this audit was opened to trace: a build dispatched
via the raw `Agent` tool failed silently four times with zero trace, while the same work dispatched through
`dispatch-lane` worked immediately and produced an inspectable run record. The mechanism difference is real,
not cosmetic — `claude --bg` returns a session the waker can poll and resume (`inFlight`/`dispatch: true` on
the effect executor, #3073/#3084), while an in-session `Agent` spawn's liveness is whatever the parent session
happens to still be tracking. Conveyor is the standing delivery loop this constellation runs nightly; every
tick that still dispatches by hand carries the failure mode #3037 was built to remove.

## What changes

Steps 3 and 3b (`spawnBuilds`, `spawnPrepareScope`) call `node we:scripts/operations/run.mjs dispatch-lane`
(or the operation's programmatic entry point, if the conveyor runner already imports operation code rather
than shelling a CLI) once per surfaced dispatch, instead of hand-filling the brief and spawning an `Agent`
directly. The tick-core call, the guard bookkeeping (`nextState.buildGuards`/`nextState.prepareGuards`), and
the brief-fill are already inside the operation's `read`/`effect` steps — the skill's prose collapses to
"run the operation with this tick's dispatch plan," not a re-description of what it does internally.

**Check before assuming a straight swap:** `dispatch-lane`'s declaration/io need to be re-read against
BOTH conveyor use sites (`spawnBuilds` build dispatch AND `spawnPrepareScope` prepare-scope dispatch) — #3037
may have been built against one and not the other; confirm the operation's `read` step actually covers
`spawnPrepareScope`'s distinct brief (`we:skills-src/conveyor/prepare-scope-agent-brief.md`) before assuming
one call replaces both step 3 and step 3b, or file the gap as a fast-follow if it only covers builds today.

## Not in scope

Steps 3c–3e (fix dispatch, CI-heal dispatch) and the panel-reviewer/editor/validator spawns inside step 4 —
those are separate prose sites, not named by `dispatch-lane`'s own scope, and the panel/validator/editor sites
are the subject of the sibling item "subagent independent reviewers aren't independent" (relatedTo above), not
this one.

## Done when

1. `we:skills-src/conveyor/SKILL.md` steps 3 and 3b call `dispatch-lane` instead of hand-spawning an `Agent`
   with the filled brief, for whichever of the two the operation's current scope actually covers (confirmed
   against live code, not assumed).
2. Any gap between `dispatch-lane`'s current scope and what steps 3/3b need is either closed here or filed as
   its own small follow-on, named explicitly (no silent partial coverage).
3. `npm run check:standards` — 0 new errors.
