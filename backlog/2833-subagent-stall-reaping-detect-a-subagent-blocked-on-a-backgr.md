---
bornAs: xr8wfqx
kind: story
size: 3
parent: "2612"
status: resolved
dateOpened: "2026-08-02"
dateStarted: "2026-08-02"
dateResolved: "2026-08-02"
tags: [conveyor, orchestrator-mechanization, harness, subagent]
---

# Subagent-stall reaping — detect a subagent blocked on a background wait and reap/resume it

The harness/orchestrator must detect a subagent that is blocked waiting on a background monitor and reap or resume it — or subagents must run their checks synchronously — so no main-session babysitting is needed.

## The concrete gap — what the main session did by hand tonight

- **A build subagent stalled waiting on a background monitor.** It launched a check in the background and then blocked, waiting for a completion signal that never advanced it. The subagent sat idle indefinitely.
- **The main session had to manually resume it.** Nothing detected the stall; a person noticed the agent was stuck and nudged it back into motion.

## Why this blocks a session-free conveyor

The conveyor dispatches build/review work into subagents and depends on each one either finishing or failing on its own. A subagent that blocks forever on a background wait is an invisible stall: it holds a lane, produces nothing, and never errors — so nothing reclaims it. In a session-free conveyor there is no main session watching for a stuck agent to nudge, so one such stall silently parks a lane and drains conveyor throughput until a human happens to look. Autonomy requires that a blocked-on-background-wait subagent be self-detected and cleared.

## The mechanical fix

Pick whichever is cleaner (or both — the detector is the backstop):

- **Reap/resume (harness backstop).** The harness/orchestrator detects a subagent that has been blocked on a background wait past a threshold (no forward progress, waiting on a monitor that has already settled or is not advancing) and REAPS it (fail + reclaim the lane) or RESUMES it (deliver the awaited signal). This is a general safety net regardless of how the subagent was written.
- **Synchronous checks (remove the footgun).** Subagents run their checks SYNCHRONOUSLY rather than launching a background monitor and blocking on it — so there is no background-wait to stall on in the first place. This removes the stall class at the source for conveyor-dispatched agents.

Either way, no main-session babysitting is required to get a stalled subagent moving again.

## Acceptance

- A subagent blocked on a background wait past a threshold is automatically detected and either reaped (failed + lane reclaimed) or resumed — with no main-session intervention.
- Alternatively (or additionally), conveyor-dispatched subagents run their checks synchronously, so the background-wait stall class cannot occur.
- Regression: reproduce the stalled-build-subagent scenario — a subagent that blocks on a never-advancing background monitor is cleared automatically, and its lane is freed.

## Resolution — a synchronous-verify wrapper + a marker + a finish-guard in the delivery path

Prevention-introspection lens: the ROOT cause is that the long verification was *backgroundable*, and yielding
mid-run *looked complete*. The fix makes an unfinished verification NOT look complete, at the source and at the
gate:

- **`we:scripts/verify-lane.mjs`** — the SYNCHRONOUS verification wrapper the build flow now runs. It runs the
  required suites in the FOREGROUND (blocks until they exit) and writes a lifecycle marker to `.git/.lane-verify`,
  keyed to the lane's HEAD commit: `running` at start, rewritten to `green`/`red` at finish. "Background then
  yield" stops being the path of least resistance (the tool is a blocking call), and a process killed mid-run
  strands a `running` marker.
- **`we:scripts/lib/lane-verify.mjs`** — the pure decision core (`verifyGateDecision`), unit-tested.
- **finish-guard in `we:scripts/pr-land.mjs`** — before publishing the lane ref it reads the marker for the HEAD
  it is about to land and REFUSES when the verification is `running` (unfinished — the exact stall) always, or,
  under `--require-verified`, absent/red. `WE_LAND_UNVERIFIED=1` is the documented break-glass. The conveyor/solo
  delivery brief passes `--require-verified`; the CI-gated drain / parallel-workflow paths (which verify via the
  required GitHub `test` check, not this marker) are not blocked.

Rejected alternatives: (a) a *pure* synchronous wrapper — removes the footgun but is unenforced, so nothing
catches a lane that skipped it; (b) a *pure* finish-guard — has no signal to check without the marker, so the
marker is intrinsic to it; (c) the guard on `we:scripts/lane-pool.mjs` `release` instead of `we:scripts/pr-land.mjs`
— release is also the drain's benign post-land cleanup, so gating it would wedge the drain; `pr-land` is the SOLE
WRITER TO MAIN and the true "delivered" gate. Harness/agent-runtime reaping of a stuck process is out of repo
scope — this is the in-repo surface that makes the stall self-evident and refuses to let a half-verified lane
deliver. The finish-guard is backed by a `PreToolUse(Bash)` guard (`we:scripts/guard-bash.mjs`) that DENIES a
backgrounded verification-set run (`verify-lane`/`check:standards`/`test:unit`) at the source, so backgrounding is
structurally blocked, not just discouraged in the delivery brief's prose.

### Scope actually delivered vs deferred (narrowed on the #983 review)

This PR delivers the **"synchronous checks (remove the footgun)"** acceptance criterion and the write-time guard
against backgrounding it. It does **NOT** deliver the other two ACs, which are tracked as a follow-up under the
conveyor epic in **#2881**:

- the **harness/orchestrator reap-or-resume backstop** — detecting a subagent blocked on a never-advancing
  background wait past a threshold and reaping (fail + reclaim its lane) or resuming it; and
- the **regression** that reproduces a stalled build subagent and proves it is cleared automatically with its lane
  freed.

Both depend on agent-runtime capability that is largely out of in-repo scope (as noted above), so they are split
off rather than claimed here.
