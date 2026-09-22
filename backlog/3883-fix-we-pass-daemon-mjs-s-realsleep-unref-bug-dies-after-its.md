---
bornAs: xjdmki2
kind: task
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/pass-daemon.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Fix we:pass-daemon.mjs's realSleep unref bug (dies after its first pass)

we:skills-src/conveyor/pass-daemon.mjs's realSleep unrefs its setTimeout, same live-caught bug found in #3870/#3876 (their own realSleep helpers): a resident daemon's sleep timer must stay ref'd, or Node exits before it fires once nothing else keeps the event loop alive between runs. This file already merged to main (#3871) with the bug present -- unlike #3870/#3876 it was never actually run live (DAEMON_MANIFEST is still empty, so nothing has dispatched through it yet), but the same fix applies before #3873 wires it up to anything real. Remove the .unref() from realSleep only; the heartbeat setInterval's own .unref() is correct to leave as-is (it is not meant to be a standalone keep-alive -- the sleep timer already guarantees that once fixed).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/pass-daemon.test.mjs` passes (10/10), including a new test that spies on `global.setTimeout` to assert `realSleep`'s real `Timeout` object is ref'd (`hasRef() === true`) — confirmed to fail against the pre-fix code by temporarily reverting the change and re-running.
