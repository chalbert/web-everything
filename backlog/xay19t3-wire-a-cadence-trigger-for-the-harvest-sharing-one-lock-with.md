---
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: []
---

# Wire a cadence trigger for the harvest, sharing one lock with the manual command

Fork 4 of #2978 rules the harvest fires on a cadence in addition to the manual `/harvest` command. The hook point exists — `we:scripts/conveyor/tick-core.mjs` is the tick, and `poolStatus()` (`we:scripts/conveyor/learnings-harvest.mjs:173-182`) already returns the depth/age numbers a threshold would read — this is wiring, not new machinery.

#2978 previously cited this as "already filed as #x5nbg4n", a hash that resolves nowhere; this item is the real filing. The manual `/harvest` trigger stays available, and the cadence tick and a manual run must share ONE lock (the singleton pattern `we:scripts/conveyor/*` already uses) so the two can never double-file — that lock is this item's to build.
