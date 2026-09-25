---
bornAs: xpe1s8f
kind: story
size: 2
parent: "4075"
status: active
scope: ["we:skills-src/conveyor/verify-daemon.mjs", "we:scripts/conveyor/verify-dispatch.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
tags: []
---

# Verify daemon: heartbeat its lease during a gate run, so a long gate cannot let a second daemon start the same lane

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Finding V1, safety part (just fix it now; the gate becomes a job under 4120 later). we:scripts/conveyor/verify-dispatch.mjs line 358 awaits spawnGateBounded to completion, one lane after another; a gate may run 30 min (VERIFY_DISPATCH_TIMEOUT_MS, line 104) after a queue phase of up to ~125 min. we:skills-src/conveyor/verify-daemon.mjs lines 96-101 heartbeat only after the whole tick returns, and the runner lease TTL is 15 min. The file's own header records a 19-20 min gate. So the lease can expire mid-gate and a second daemon instance can start the same lane. Fix shape: a heartbeat timer that runs while the tick is awaited (the drain daemon pattern), and the tick stops if the heartbeat reports the lease lost. Done when: a test with a stubbed 20-min gate and a 15-min TTL proves the lease stays held; LIVE proof: lease heartbeatAt samples during a real gate run advance at least every 2 min (quote them in the PR).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
