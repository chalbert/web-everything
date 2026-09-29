---
kind: story
size: 3
status: open
blockedBy: ["4468"]
scope: ["we:scripts/lib/daemon-boot-watchdog.mjs", "we:skills-src/conveyor"]
dateOpened: "2026-09-29"
tags: []
---

# Wire the #4468 daemon boot-crash-loop supervisor into a real daemon's launch config

#4468 built the crash-loop-revert mechanism (we:scripts/lib/daemon-boot-watchdog.mjs: decideCrashLoop + runSupervisedStart) as a standalone, tested module, deliberately NOT wired into any real daemon's launch path (same mechanism-only scoping we:skills-src/conveyor/daemon-manifest.mjs used) — proven only against a scratch clone, per the never-restart-a-real-daemon constraint on that item. This follow-up does the real wiring: point at least one real standalone daemon's actual launch (today a bare node invocation of its own entry module under launchd KeepAlive) at the supervisor CLI in place of the bare entry, choose real N/K values from observed real boot times, and prove it live on that one real daemon's own dedicated clone without ever leaving it down.

## Done when

1. **Real daemon wiring** — one real standalone daemon's launch config (today a bare `node <entry>.mjs`
   invocation under launchd `KeepAlive`) starts through `we:scripts/lib/daemon-boot-watchdog.mjs`'s CLI in
   place of the bare entry — verifiable by reading that daemon's actual launch config/plist and confirming the
   command line names the watchdog script, not the entry directly.
2. **Tuned N/K** — the survival window and crash-loop count are set from real observed boot times for that
   daemon (not left at the library defaults) and the values are recorded in this item's own body with the
   observation they came from.
3. **Live proof, no downtime** — a deliberately-broken commit is loaded onto that daemon's OWN dedicated
   clone and the daemon self-heals (reverts and restarts clean) with no manual intervention and no extended
   outage — proven by a timestamped before/after log excerpt in the PR body, not merely inferred from a green
   gate.
