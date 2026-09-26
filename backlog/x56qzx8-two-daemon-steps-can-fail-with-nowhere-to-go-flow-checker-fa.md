---
kind: story
size: 1
parent: "4075"
status: open
blockedBy: ["x7fupdt", "xfzc49z"]
scope: ["we:scripts/conveyor/flows/"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Two daemon steps can fail with nowhere to go (flow checker: failure-no-exit)

Found by we:scripts/conveyor/flows/check.mjs (xr05jjl), rule failure-no-exit. daemon-rebuild step mutate-overlay-list: the overlay-list mutex's 20s timeout throws from inside a rebuild (we:scripts/lib/daemon-overlays.mjs:139), uncaught until the daemon's generic per-tick catch, so the whole tick's dispatch work is skipped with no distinct state. build-dispatch step run-lane-pool-acquire: the builder session's lane acquire can fail with no defined outcome. Give each a named failure state (logged, retried with a bound, escalated) and update the flow files.

## Sliced by file (2026-09-26)

The work is split by FILE, not by gap type, so each slice has a disjoint code scope and slices can run in parallel: x7fupdt, xfzc49z. Each slice clears its own findings from the flow files. This card is now the closeout: once every slice has landed, confirm the check below and record the live proof.

## Done when

1. **Executable** — every flow finding acknowledged with `x56qzx8` is gone: `node we:scripts/conveyor/flows/check.mjs --json` lists no finding whose `acknowledged` is `x56qzx8`, and the `ack` entries naming `x56qzx8` are removed from the flow files (the flow data updated to the fixed code, cited). `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green.
2. **Live proof** — for at least one of the listed states, a before/after on the real daemons showing the new bound / cap / escalation firing.
