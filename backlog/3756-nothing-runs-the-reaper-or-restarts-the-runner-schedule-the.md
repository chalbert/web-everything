---
bornAs: xniui42
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/tick-once.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Nothing runs the reaper or restarts the runner: schedule the reaper and alert when the runner is down

FOUND 2026-09-20. The conveyor runner is not live (no singleton lease), so nothing runs the reaper and the report labelled its remedy auto for 16 hours; finished sessions accumulate (54 live and 704 listed today, 28 stuck as working). Only a hand run cleans up. DESIGN TO SETTLE (strong design required): (1) who runs the reaper: the tick (through the tick-once hook) every N ticks, or a scheduled routine, and how it stays safe beside a live runner; (2) a runner-down alert as one line with the start command, and how long it has been down, from a real source; (3) never auto-start the runner when load is above the worker cap, and never stop the drain daemon. ACCEPTANCE: after the schedule lands, finished sessions do not accumulate beyond a stated bound over 24 hours; a stopped runner produces one alert within a stated time; a test proves two overlapping reaper runs do not double-stop.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
