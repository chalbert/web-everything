---
bornAs: xiuw0u4
kind: task
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/runner-lock.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# a force-killed daemon's runner lease blocks every restart for the full TTL

Live-caught twice on 2026-09-23 restarting the review daemon. A daemon tick runs long synchronous execFileSync calls, so a SIGTERM that lands mid-tick cannot run the shutdown handler; launchd's kickstart -k then SIGKILLs the process and its runner lease is never released. Every restart after that (launchd KeepAlive retries every 60s) exits with 'a live instance already holds the lease' naming the DEAD pid, until the lease's heartbeat TTL expires -- the daemon is silently down for up to the full lease window. Both times it was cleared by hand after confirming the owner pid was dead. Fix: in we:skills-src/conveyor/runner-lock.mjs acquireRunnerLease, when the existing lease's owner is on THIS host and its pid is confirmed dead (process.kill(pid, 0) throws ESRCH), reclaim it immediately instead of waiting out the TTL -- the same same-host pid-liveness fast path we:scripts/readiness/heavy-admission.mjs and we:scripts/lib/gh-throttle.mjs already layer on their own leases. A lease owned by another host keeps the TTL rule unchanged. Applies to every daemon on this lease primitive (review, fix-dispatch, verify, pass-daemon).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/runner.test.mjs -t "3952"` fails at the
   parent commit (`acquireRunnerLease` refuses a same-host lease owned by a provably-dead real pid, `{ok:
   false, reason:'held'}`) and passes after `acquireRunnerLease` probes the current holder's pid liveness
   (`probeRunnerLeaseLiveness`, we:skills-src/conveyor/runner-lock.mjs) and fast-reclaims it (`{ok:true,
   reason:'pid-dead'}`), while a lease held by a genuinely live pid, or one recorded for a different host,
   is still refused unchanged.
