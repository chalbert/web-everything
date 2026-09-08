---
kind: task
parent: "3403"
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Build-guard TTL note claims re-dispatching when the durable floor is actually suppressing it

retireBuildGuards (we:scripts/conveyor/tick-core.mjs ~line 307/1035) fires a per-tick '#N never claimed after N ticks — re-dispatching' note for a num whose #3403 durable build-guard floor (~line 920) is still re-synthesizing a guard because claude agents --json still lists its conveyor-<num> session (e.g. stuck in Claude Code's own 'blocked' state). filterLaunches (~line 336) correctly suppresses the actual relaunch in that case, so the note's 're-dispatching' claim is false and repeats every tick the session stays listed — live-confirmed on wev-scratch-dispatcher-4's runner.log (#3370 and ~10 others firing the note on 15+ of 41 ticks while conveyor-3370 stayed listed, state blocked, the whole time, with zero actual respawns). Fix: only surface the note when durableBuildNums(liveAgentSessions) will NOT immediately re-suppress the same num this tick, and make it a one-time warning (mirrors prepare-ttl's documented one-time intent) rather than a per-tick repeat.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
