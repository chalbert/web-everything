---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/claude-auth-health.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/health-watch-core.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Every daemon wait and pause has a bound and a notify (flow checker: unbounded-wait / no-owner)

Found by we:scripts/conveyor/flows/check.mjs (xr05jjl), rules unbounded-wait and no-owner: these states wait with no timeout and nothing tells anyone. build-dispatch: held-admission (capacity/load/queue holds retry every tick, no owner, no notify; we:scripts/conveyor/tick-core.mjs:1256), awaiting-dispatch-invocation (needs a live /conveyor session), pr-land-failed (infra-blocked). fix + review: login-broken-paused / claude-auth-paused (x5kagse pause lifts only on the next probe; no notify). ci-heal: owed-ci-rerun-wait (main red for any length of time), ci-heal-session-running (no intrinsic timeout; stuck-pr watch has no ci-red stage). conflict: rearm-deferred (name-based liveness, no clock). drain-land: lease-arbitration. lane-lifecycle: lane-manual-reclaim-blocked. Each needs a bound (timeout + what happens) or a health-watch episode after N minutes; update the flow files so the findings clear.

## Done when

1. **Executable** — every flow finding acknowledged with `xwo3j0l` is gone: `node we:scripts/conveyor/flows/check.mjs --json` lists no finding whose `acknowledged` is `xwo3j0l`, and the `ack` entries naming `xwo3j0l` are removed from the flow files (the flow data updated to the fixed code, cited). `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green.
2. **Live proof** — for at least one of the listed states, a before/after on the real daemons showing the new bound / cap / escalation firing.
