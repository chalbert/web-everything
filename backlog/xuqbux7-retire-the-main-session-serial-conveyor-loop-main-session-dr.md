---
kind: story
size: 3
parent: "2677"
status: open
blockedBy: ["xyp63w5", "xoh0xzj"]
scope: ["we:skills-src/conveyor/SKILL.md"]
dateOpened: "2026-07-27"
tags: []
---

# Retire the main-session serial conveyor loop — main session drops to judgment plus operator conversation only

The terminal cleanup of #2677: once the mechanical core (#xyp63w5) and the per-lane orchestrators (#xoh0xzj) cover dispatch/watch/release/tick, rewrite we:skills-src/conveyor/SKILL.md so the MAIN session no longer runs the serial tick loop — it drops to genuine judgment only (escalation review, forks, ratifying) plus the operator conversation. Removes the chained-sleep heartbeat + guard bookkeeping from the main session's job. Blocked on both prior slices (nothing to retire the serial loop onto until they land). Incremental delivery: this is #2677's endpoint.
