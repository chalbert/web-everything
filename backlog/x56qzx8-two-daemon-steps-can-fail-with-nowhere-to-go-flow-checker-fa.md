---
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/daemon-overlays.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Two daemon steps can fail with nowhere to go (flow checker: failure-no-exit)

Found by we:scripts/conveyor/flows/check.mjs (xr05jjl), rule failure-no-exit. daemon-rebuild step mutate-overlay-list: the overlay-list mutex's 20s timeout throws from inside a rebuild (we:scripts/lib/daemon-overlays.mjs:139), uncaught until the daemon's generic per-tick catch, so the whole tick's dispatch work is skipped with no distinct state. build-dispatch step run-lane-pool-acquire: the builder session's lane acquire can fail with no defined outcome. Give each a named failure state (logged, retried with a bound, escalated) and update the flow files.

## Done when

1. **Executable** — every flow finding acknowledged with `x56qzx8` is gone: `node we:scripts/conveyor/flows/check.mjs --json` lists no finding whose `acknowledged` is `x56qzx8`, and the `ack` entries naming `x56qzx8` are removed from the flow files (the flow data updated to the fixed code, cited). `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green.
2. **Live proof** — for at least one of the listed states, a before/after on the real daemons showing the new bound / cap / escalation firing.
