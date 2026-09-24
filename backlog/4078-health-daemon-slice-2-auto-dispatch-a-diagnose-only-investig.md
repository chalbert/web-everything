---
bornAs: x61epyr
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["4065", "4077"]
scope: ["we:scripts/conveyor/health-investigate-dispatch.mjs", "we:skills-src/conveyor/health-investigate-brief.md", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/operations/dispatch-lane.mjs"]
dateOpened: "2026-09-24"
tags: [health-daemon]
---

# Health daemon slice 2: auto-dispatch a diagnose-only investigation agent per smell episode

Second slice of 4065 (Fork 2). When an agent-eligible smell opens an episode and its deterministic
diagnosis did not settle the cause, dispatch one diagnose-only agent:

- Launched as a **new kind on the declared `dispatch-lane` operation**
  (#conveyor-dispatch-calls-the-declared-operation clause 1), not by importing the spawner the stuck-PR
  inspector uses. The model comes from dispatch routing for the investigator role (never hand-set).
- **Tool surface: declared read operations only** (runner-activity, stale-state, dispatch-eligibility,
  github-app-status, bounded transcript reads). Edit, Write and every `gh` write, including
  `gh pr comment`, are denied — the agent reads untrusted transcript text.
- **Budget**: one per episode, 1 running at a time, 6 per rolling 24 h, a 20-minute wall clock enforced by
  stopping the session through we:scripts/conveyor/session-reaper.mjs; no dispatch while an inhibiting
  episode (App token / rate limit, high load) is open; no fourth investigation on a (smell, subject) within 7
  days.
- **Output**: evidence with cited command output and a structured recommendation (what is wrong, the product
  change that fixes it, one-line next step) written into the episode report after the privacy scrub of
  #automated-session-introspection clause 3. Never applies a fix.
- Stays off in `shadow` until the operator turns dispatch on.

## Done when

1. **Executable** — tests prove: the dispatch plan refuses a second agent for the same episode, refuses
   under an inhibiting episode, refuses past the 24 h budget; the spawned argv carries the read-only tool
   surface (Edit, Write, `gh pr comment` denied).
2. **Live proof** — with dispatch turned on, one real episode yields one investigation whose findings land in
   the episode report, and the session is reaped at or before the wall clock.
