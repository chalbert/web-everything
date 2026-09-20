---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/tick-once.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# tick-once follow-ups: failure backoff, quiet launch, status-file collision, two-process test

FROM the tick-once result (2026-09-20). (1) A failed tick does not throttle the next, so if gh is down every wakeup retries with no backoff. (2) Node prints the JSON-import ExperimentalWarning and a punycode deprecation before main can capture anything; the hook must launch with stdio ignored or node no-warnings. (3) With apply, the status file and decision trace are written in the checkout the script lives in; a hook and a resident runner in the same checkout show whichever ticked last. (4) Two concurrent tick-once PROCESSES were not tested (two throttles in one process were). (5) The throttle claim comes before the mutex, so a mutex-busy tick leaves one failed attempt record per busy wakeup. ACCEPTANCE: a bounded backoff after a failed tick with a test; a launch wrapper or flag that is silent; a two-process test; the status file records which driver wrote it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
