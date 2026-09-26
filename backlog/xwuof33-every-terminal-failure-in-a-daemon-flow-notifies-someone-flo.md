---
kind: story
size: 1
parent: "4075"
status: open
blockedBy: ["xilx617", "xxwkomm", "x7w2lc1", "x7fupdt", "xfzc49z", "xxjsz67"]
scope: ["we:scripts/conveyor/flows/"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Every terminal failure in a daemon flow notifies someone (flow checker: silent-failure)

Found by we:scripts/conveyor/flows/check.mjs (xr05jjl), rule silent-failure: these end-states finish a flow and tell no one. build-dispatch: session-spawn-failed, session-reaped-no-outcome, pr-land-failed. fix: round-cap-hit (only a daemon log line, we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:520). review: round-cap-exhausted (5-round cap, we:scripts/conveyor/reconcile-core.mjs:1257, no note, no label). daemon-rebuild: stuck-needs-hand-fix, held-pinned-refusal (never raises clone-held-stale, we:scripts/lib/daemon-rebuild.mjs:866), cli-overlay-op-failed. lane-lifecycle: acquire-failed. session-cleanup: dispatch-scratch-orphaned (sweep opt-in, never scheduled). Each needs an escalation (operator-notify / review:human / health episode) and the flow file updated so the finding clears. Evidence and cites: the flow files under we:scripts/conveyor/flows/.

## Sliced by file (2026-09-26)

The work is split by FILE, not by gap type, so each slice has a disjoint code scope and slices can run in parallel: xilx617, xxwkomm, x7w2lc1, x7fupdt, xfzc49z, xxjsz67. Each slice clears its own findings from the flow files. This card is now the closeout: once every slice has landed, confirm the check below and record the live proof.

## Done when

1. **Executable** — every flow finding acknowledged with `xwuof33` is gone: `node we:scripts/conveyor/flows/check.mjs --json` lists no finding whose `acknowledged` is `xwuof33`, and the `ack` entries naming `xwuof33` are removed from the flow files (the flow data updated to the fixed code, cited). `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green.
2. **Live proof** — for at least one of the listed states, a before/after on the real daemons showing the new bound / cap / escalation firing.
