---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# the conveyor tick executes spawnBuilds by hand instead of through dispatch-lane

`we:skills-src/conveyor/SKILL.md` instructs `we:scripts/conveyor/tick-core.mjs` for the whole per-tick state machine, then has the agent EXECUTE the decisions — including `spawnBuilds`, which is exactly what the `dispatch-lane` operation declares over. The skill needs the full tick, so it cannot simply be renamed to the operation; the dispatch half should route through `dispatch-lane` while the rest of the decisions stay hand-executed. Found by the #3224 scan on its first run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
