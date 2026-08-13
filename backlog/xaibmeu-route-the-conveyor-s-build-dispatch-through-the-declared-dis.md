---
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3037"]
dateOpened: "2026-08-13"
scope:
  - we:skills-src/conveyor/
scopeRationale: "Switches the conveyor SKILL's dispatch bridge to call the already-declared operation; the operation itself is unchanged."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Route the conveyor's build dispatch through the declared dispatch-lane operation

#3037 declared and registered the dispatch operation, but the conveyor still dispatches the old way: the runner
surfaces `decisions.spawnBuilds` and the main-session bridge spawns each one with the harness `Agent` tool
(`we:skills-src/conveyor/SKILL.md` §3). Two dispatch paths now exist and only one records a durable handle, so a
restart still loses a build the bridge launched. Switch the bridge to call the operation per surfaced launch and
delete the hand-spawn prose.

## The seams to watch

- **The operation shells its OWN tick read.** The bridge must pass its live bookkeeping as `--bookkeepingFile`
  or the read runs guard-less (`guardsFrom: 'none'` on the verdict). Note that the operation forwards only the
  `bookkeeping` key — `config` and `signals` are dropped and reported as `droppedBookkeeping`, so a runner using
  non-default TTLs gets the shipped ones instead; check that before switching.
- **The first LIVE dispatch happens here.** #3037 asserted the `claude --bg --session-id …` argv and never fired
  it. This item settles what a background session's permission mode and isolation default have to be
  (`WE_DISPATCH_AGENT_ARGS` is the knob), and whether the brief's step 1 works from a background agent.
- **The agent-runner CLI backend ruling**
  ([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) may want to own the
  spawn instead. This item is where the two designs meet; if the ruling wins, the operation becomes its caller.
- **Land #x9ylkp7 first or with this.** Until the observer can resolve a finished build, every real dispatch
  leaves an entry the waker re-reports forever and eventually exits non-zero on.

## Acceptance

The conveyor dispatches builds only through the declared operation, one live dispatch has been observed end to
end (agent started, handle recorded, run resumable after a restart), and the SKILL no longer instructs a
hand-rolled `Agent` spawn for a build.
