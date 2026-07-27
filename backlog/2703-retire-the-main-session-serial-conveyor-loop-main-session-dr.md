---
bornAs: xuqbux7
kind: story
size: 3
parent: "2677"
status: resolved
graduatedTo: none
blockedBy: ["2699", "2702"]
scope: ["we:skills-src/conveyor/SKILL.md"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Retire the main-session serial conveyor loop — main session drops to judgment plus operator conversation only

The terminal cleanup of #2677: once the mechanical core (#2699) and the per-lane orchestrators (#2702) cover dispatch/watch/release/tick, rewrite we:skills-src/conveyor/SKILL.md so the MAIN session no longer runs the serial tick loop — it drops to genuine judgment only (escalation review, forks, ratifying) plus the operator conversation. Removes the chained-sleep heartbeat + guard bookkeeping from the main session's job. Blocked on both prior slices (nothing to retire the serial loop onto until they land). Incremental delivery: this is #2677's endpoint.

## Progress

Rewrote `we:skills-src/conveyor/SKILL.md` to retire the main-session serial tick loop onto the #2702 headless
runner (ratified boundary #2701):

- **§2 was the chained-sleep loop; it is now "Launch the headless runner."** The old steps 1/2/2b (main session
  reads state → plans dispatch → steps tick-core with STDIN bookkeeping it threaded) are gone. The section now
  says: launch `we:skills-src/conveyor/runner.mjs` once as a background process; it steps the tick core, threads
  `nextState`, runs the §4b/§4c passes, heartbeats its singleton lease, emits the surface, and owns idle-stop —
  all headlessly, no model context.
- **The chained-sleep heartbeat is removed from the main session's job.** §5 no longer arms a `sleep`; the
  runner sleeps ~120 s and heartbeats itself. §6 (idle-stop) and §7 (final ledger) reframed to the runner's
  clock + the runner's stop-exit waking the main session.
- **The guard bookkeeping is removed from the main session's job.** The four guard blocks, the "in-flight
  dispatch guard," and §5's status counts are reframed: the bookkeeping rides the runner's `nextState`, not
  main-session prose. §4b/§4c are the runner's deterministic passes, not steps the main session runs.
- **Main session drops to judgment + operator conversation.** Frontmatter description, the intro, the THIN
  callout, and the closing "split, restated" all reframed: the main session launches the runner and does the
  judgment (escalation review, decisions, ratifying, epics→slice, anomalies) plus the operator conversation.
- **Honest interim bridge.** The runner SURFACES dispatch/watch decisions but does not spawn LLM agents yet
  (that is the ratified `#agent-runner-cli-backend` interface, not yet wired into the runner). Until it is, the
  main-session judgment layer executes the surfaced spawns/watchers as a thin mechanical bridge the backend will
  absorb — documented as explicitly interim, so §3–§4's agent-instantiation detail is preserved and accurate.

Scope held to the single file `we:skills-src/conveyor/SKILL.md` (a doc rewrite; no code, no gate/statute path).
Gate `check:standards` green (0 errors). The blocked follow-up is wiring headless LLM agent-spawning into the
runner (the `#agent-runner-cli-backend` backend) — out of scope for this doc-only endpoint.
