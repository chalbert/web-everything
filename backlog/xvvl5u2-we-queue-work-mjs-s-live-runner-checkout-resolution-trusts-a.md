---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: [conveyor, security]
---

# we:queue-work.mjs's live-runner checkout resolution trusts a recorded pid with no identity check, so a fast crash+reuse can resolve to an unrelated process's cwd

WE #3478's we:scripts/conveyor/queue-work.mjs resolves the live conveyor runner's checkout by reading its singleton lease's recorded pid, then shelling lsof to find that pid's cwd. If the runner crashes and the OS reuses its exact pid for an unrelated process before the lease's heartbeat goes stale (a narrow race, bounded by the lease TTL), resolveLiveRunnerCheckout will report ok:true for that unrelated process's cwd, and its add/remove/list verbs will silently target that unrelated checkout's we:.conveyor/queue.json -- recreating, via a different trigger, the exact failure mode #3478 was filed to eliminate. Found by an adversarial /converge security-lens review of #3478's diff (round 1, disposition: carve-out -- introduced, not worse than the pre-existing lock design's own known PID-reuse limitation (see we:scripts/readiness/file-locks.mjs's own PID-liveness-is-never-primary precedent), parallelizable). Proposed direction: have the runner lease also record a process-identity fingerprint (e.g. process start time from lsof/ps, or a per-run random token written to a file the resolver cross-checks) so the resolver can detect pid reuse and return a distinct refusal reason instead of trusting the recycled pid's cwd; add a test that plants a lease for a real pid, kills that process, spawns a different process that gets the same pid, and asserts refusal.

## Done when

1. **Executable** — a test plants a runner lease for a real pid, kills that process, spawns a different
   process that gets the same pid (or otherwise simulates pid reuse), and asserts the resolver refuses
   with a distinct reason rather than reporting `ok:true` for the unrelated process's cwd.
