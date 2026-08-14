---
bornAs: xaibmeu
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
- **Land #3095 first or with this.** Until the observer can resolve a finished build, every real dispatch
  leaves an entry the waker re-reports forever and eventually exits non-zero on.

## It carries the other half of #3037's acceptance

Ruled by the independent review of PR #1211, and written into #3037's own acceptance rather than left in a
footnote: **the clause "a lane IS dispatched through the declared operation … with the same scope-lease
arbitration … verified against a real queue" is REASSIGNED here.** #3037 delivered the declaration, the
structural holds and the durable handle; nothing has ever been dispatched, and the lease is taken by the agent
running `lane-pool acquire` from the brief — a path that has not executed. This item is where that clause is
met, so #3037 is not fully accepted until this one is.

Named classes of defect only a live run can catch (from the same review, so they are checked here and not
rediscovered): a background session's permission mode (the agent's first act is `bash` inside a `$( … )`, and a
prompt there stalls it holding a handle that reads `running` forever); whether `--session-id` really pins the id
that `claude agents` reports back; whether `-n` is the session-name flag; what the child inherits from a
conveyor runner's environment (`spawnAgent` passes no `env`); and the agent's lane acquisition racing the
parent's assignment, which is the entire reason the in-flight guard exists.

## Acceptance

The conveyor dispatches builds only through the declared operation, one live dispatch has been observed end to
end (agent started, handle recorded, run resumable after a restart), the scope-lease arbitration has been
exercised by that live agent's own `acquire`, and the SKILL no longer instructs a hand-rolled `Agent` spawn for
a build.
