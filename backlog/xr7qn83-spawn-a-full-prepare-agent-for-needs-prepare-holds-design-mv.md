---
kind: story
size: 5
status: open
blockedBy: ["4470"]
scope: ["we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/prepare-item-agent-brief.md", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Spawn a full prepare agent for needs-prepare holds (design/MVP/test/proof-plan authoring, not just scope)

Card #4470 adds a needs-prepare readiness hold (a scoped story/task with no truthful preparedDate is never dispatched to build) but its MVP cut deliberately stops at the gate — it does not spawn anything for a needs-prepare hold. This item builds that spawn: a new prepare-item agent brief that does the FULL prepare pass (premise check, scope correction, Design/MVP/Test-plan/Proof-plan authoring, prepare-stamp) for a generic story/task — distinct from the existing prepare-scope agent (spawnPrepareScope / we:prepare-scope-agent-brief.md), which only authors a missing scope field, a narrower mechanical edit. Wire it into we:tick-core.mjs's planPrepareSpawns (a new spawn list alongside scopeSpawns/decisionSpawns/investigationSpawns) and a new launch kind in we:dispatch-lane.mjs / we:dispatch-lane-io.mjs LAUNCH_KINDS, so a needs-prepare hold routes to this new agent the same tick-driven way unshaped-no-scope already routes to the scope-prepare agent. Done when: a needs-prepare item on a live tick spawns this agent (not a build), the agent's PR stamps preparedDate and lands via the normal PR path, and the item becomes build-eligible (dispatches normally) on a later tick.

## Done when

1. **Executable** — a live/fixture tick with a scoped, unprepared item held `needs-prepare` spawns this new
   prepare-item agent (a new entry in we:tick-core.mjs's `planPrepareSpawns`, not a build); before this item
   lands, that same tick spawns nothing for the hold (it just sits `needs-prepare` with no route out).
2. The spawned agent's own PR (a) writes `## Design` / `## MVP` / `## Test plan` / `## Proof plan` /
   `## Follow-ups` into the target item and (b) stamps `preparedDate` (via `we:scripts/backlog.mjs
   prepare-stamp` or the equivalent verb), and lands via the normal PR path.
3. On a LATER tick, the now-`preparedDate`-carrying item is build-eligible again and dispatches normally (no
   longer held `needs-prepare`) — proving the loop actually closes, not just that the agent ran once.
