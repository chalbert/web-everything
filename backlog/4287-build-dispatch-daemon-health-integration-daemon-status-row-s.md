---
bornAs: xw24bu0
kind: story
size: 3
parent: "3984"
status: open
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-27"
tags: []
---

# build-dispatch daemon: health integration (daemon-status row, stalled-dispatch smell, kill-switch surfacing)

Wire the build-dispatch daemon (we:skills-src/conveyor/build-dispatch-daemon.mjs, #3984 slice 1) into health: a daemon-status row (lease holder, last tick, freeze reasons, in-flight claims), a health smell for claims held past their build window with no PR, and the kill-switch state on the WIP report. Also move the durable build claim into dispatch-lane itself so every build dispatcher (operator session, runner surface, daemon) is fenced by the same claim, and add task-prefixed scratch-file guidance to the delivery brief.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/build-dispatch-health.test.mjs` passes: a build claim older than its build window with no delivering PR raises the new smell, the daemon-status row lists lease holder / last tick / freeze reasons, and a second dispatcher calling `dispatch-lane` for a claimed num is refused by the claim inside dispatch-lane.
