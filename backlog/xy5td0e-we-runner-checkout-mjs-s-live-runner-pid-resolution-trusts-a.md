---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: [conveyor, dispatch, delivery]
---

# we:runner-checkout.mjs's live-runner pid resolution trusts a bare pid, not process identity — a reused pid can resolve to the wrong checkout

we:scripts/conveyor/runner-checkout.mjs resolves the live conveyor runner's checkout purely from a pid match against the runner-singleton lock's heartbeat freshness (WE #3478). If the runner crashes without releasing its lock and, before the lease is judged stale, the OS reassigns that same pid to an unrelated process, resolveLiveRunnerCwd will report that unrelated process's cwd as the live runner's checkout with no refusal — reproducing #3478's own failure mode (queue-work reporting success while writing into a checkout nobody is reading) via pid reuse instead of stale script-location resolution. Narrow, low-probability race (pid reuse inside a short lease window), not a certain path — identified while building #3478 and filed as a follow-up rather than folded into it (see #3478's own Progress note). Fix shape: have the runner assert its own resolved checkout path (or a process-start-time fingerprint) into the lock entry at acquire/heartbeat time in we:skills-src/conveyor/runner-lock.mjs, so we:resolveLiveRunnerCwd reads a value the runner itself vouched for rather than re-deriving identity from a bare OS-level pid, which touches the runner-lock schema and its other callers so deserves its own scoped lane rather than folding into #3478.

## Done when

1. **Executable** — a test constructs a live runner-lock entry whose `pid` is reused by a process with a
   DIFFERENT start time than the one the lock entry was written for (or otherwise proves the current
   process is not the one the lease was acquired for), and asserts `we:resolveLiveRunnerCwd` (or
   `we:resolveRunnerPid`) refuses rather than resolving to that unrelated process's cwd.
2. The fix must not require the caller (`we:scripts/conveyor/queue-work.mjs`) to change — the identity
   check belongs in the resolution/lock layer, not duplicated at every call site.
