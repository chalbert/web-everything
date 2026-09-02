---
bornAs: xrvh17c
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-08-30"
dateResolved: "2026-09-02"
relatedTo: ["3397"]
tags: [conveyor, supervisor, timing, flagged-by-review]
scope:
  - we:skills-src/conveyor/supervisor.mjs
  - we:skills-src/conveyor/runner.mjs
  - we:skills-src/conveyor/__tests__/
---

# Supervisor's clean-exit restart has zero backoff delay — an idle-stopped runner can busy-loop respawning

Surfaced by a blind independent design review of `#3383` (2026-08-30), not yet filed until now.
`we:skills-src/conveyor/supervisor.mjs`'s `decideRestart` gives a `'clean'` classification `delayMs: 0`
— correct for the case its own doc comment names ("the child did real work and stopped for a legitimate
reason, so there is nothing to back off from"), which is right for a polite stand-down (another runner
holds the lease). But `we:skills-src/conveyor/runner.mjs`'s idle-stop is ALSO a plain `code: 0` clean
exit, and `classifyExit` cannot distinguish the two — both look identical from the supervisor's side.

**This is worse than a periodic respawn.** `assessIdleStop` (`we:scripts/conveyor/tick-core.mjs`) reads
`idleElapsedMs = now - lastOperatorTurn` — a fact about WALL-CLOCK TIME SINCE THE OPERATOR LAST ACTED, not
anything reset by the runner process restarting. So once the queue is empty and the operator has been away
past the 15-minute default window, a FRESHLY-RESPAWNED runner idle-stops on its very FIRST tick — not
after its own idle window elapses again. Combined with `decideRestart`'s zero delay on a clean exit, the
supervisor and runner enter a tight spawn → tick-once → idle-stop → exit(0) → immediate respawn cycle,
bounded only by how fast one `node` process launch + one `we:scripts/conveyor/tick-core.mjs` subprocess
call takes (sub-second to low-seconds) — a genuine busy-loop, not a periodic one, for as long as the
conveyor is legitimately idle (i.e. potentially most of the time between operator sessions).

## Where

`we:skills-src/conveyor/supervisor.mjs`'s `classifyExit`/`decideRestart` (both `kind: 'clean'` cases
collapse to the same zero-delay treatment) and `we:scripts/conveyor/tick-core.mjs`'s `assessIdleStop`
(the operator-elapsed clock that makes a restart re-trip the SAME idle-stop immediately rather than
needing its own fresh window).

## Landed

**`we:skills-src/conveyor/supervisor.mjs`** gained a separate idle-stop backoff curve
(`DEFAULT_IDLE_BASE_BACKOFF_MS`/`DEFAULT_IDLE_MAX_BACKOFF_MS`, `idleBaseBackoffMs`/`idleMaxBackoffMs`),
distinct from the existing crash-restart backoff. `classifyExit` now reads `stoppedReason` (parsed off
`we:skills-src/conveyor/runner.mjs`'s own final `--json` line — `{event:'stopped', stoppedReason}` or
`{event:'stood-down'}`) to tell a genuine idle-stop apart from a polite stand-down; `decideRestart` grows
its own consecutive-idle-stop streak/backoff for the former while a stand-down still restarts promptly with
zero delay — closing the busy-loop where a freshly-respawned runner re-tripped the same idle-stop
immediately.

1. **Done — docblocks explicitly tagged `#3406`** at the backoff constants, `classifyExit`, `decideRestart`,
   and the log-entry `kind` field (`'idle-stop'` vs `'crash'`).
2. `we:skills-src/conveyor/__tests__/supervisor.test.mjs` has substantial dedicated `#3406`-tagged coverage:
   capturing `stoppedReason` off real child stdout for both `idle-stop` and `stand-down`, "a repeated
   idle-stop grows its OWN streak/backoff", "Done-when 1: N consecutive clean exits..." proving a growing
   delay instead of `sleeps` staying all-zero, and an idle-stop backoff's own `delayMs` climbing past the
   crash ceiling.
3. Stays disjoint from `#3397` (supervisor reload lifecycle) — this is a restart-cadence bug, not a
   config-reload gap.

## Done when

1. **Executable** — a test proves that N consecutive clean exits, each reporting the SAME idle-stop reason
   in immediate succession (simulating the operator staying away), result in a growing delay between
   spawns rather than `sleeps` staying `[]`/all-zero — fails today (`runSupervisorLoop`'s existing test
   already pins clean exits to zero sleep, unconditionally), passes once idle-stop specifically backs off.
2. A design is recorded for telling "idle-stop" apart from "polite stand-down" at the supervisor's level —
   options include: `we:skills-src/conveyor/runner.mjs` exiting with a DISTINCT code for idle-stop vs.
   lease-lost/stand-down (both are `process.exit(0)` today in `main()`), or the supervisor reading the
   mirrored `--json` tick surface (already captured for `#3398`'s alerting) to recognize an idle-stop
   reason before the next spawn. Whichever is chosen, a stand-down (another runner legitimately holds the
   lease) must still restart promptly — this is NOT the same case and must not be slowed down by the same
   fix.
3. Cites `#3397` (the supervisor's missing reload lifecycle) as an adjacent but distinct gap — that card is
   about picking up config changes without a restart; this one is about a restart cadence bug on an
   already-legitimate exit reason. Not folded together.
