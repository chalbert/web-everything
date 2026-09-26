---
kind: story
size: 1
parent: "4075"
status: open
blockedBy: ["xilx617", "x5h527v", "xo2emdz", "xknejbg", "xu38vlf", "x7w2lc1", "xfzc49z", "xvaxtyd"]
scope: ["we:scripts/conveyor/flows/"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Every daemon retry loop has a cap and a place to go at the cap (flow checker: uncapped-retry)

Found by we:scripts/conveyor/flows/check.mjs (xr05jjl), rule uncapped-retry: these loops retry forever or hit a cap that goes nowhere. drain-land: pass-running (backoff caps the delay at 900s, never the count), merge-attempt, duplicate-nnn-parked (loud but never stops). fix: queue-cap-hit, fixer-blocked-infra (self-report, 15-min cooloff, redispatch, forever; we:scripts/conveyor/reconcile-core.mjs:486). review: blocked-on-infra, round-cap-exhausted (cap 5 then nowhere). conflict: unowned-mechanical-rebase-attempt. daemon-rebuild: rebuild-safety-recovery, smoke-code-reject-rollback. lane-lifecycle: lane-reclaimed-stale. build-dispatch: session-reaped-no-outcome (stop retried 3x then nowhere). Give each a count, a cap, and an escalation at the cap; update the flow files so the findings clear.

## Sliced by file (2026-09-26)

The work is split by FILE, not by gap type, so each slice has a disjoint code scope and slices can run in parallel: xilx617, x5h527v, xo2emdz, xknejbg, xu38vlf, x7w2lc1, xfzc49z, xvaxtyd. Each slice clears its own findings from the flow files. This card is now the closeout: once every slice has landed, confirm the check below and record the live proof.

## Done when

1. **Executable** — every flow finding acknowledged with `xb4yerj` is gone: `node we:scripts/conveyor/flows/check.mjs --json` lists no finding whose `acknowledged` is `xb4yerj`, and the `ack` entries naming `xb4yerj` are removed from the flow files (the flow data updated to the fixed code, cited). `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green.
2. **Live proof** — for at least one of the listed states, a before/after on the real daemons showing the new bound / cap / escalation firing.
