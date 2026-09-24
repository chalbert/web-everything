---
bornAs: xulwmqi
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/main-staleness.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# fix-dispatch/review daemons: mid-tick stale-main race + shared-clone self-sync blind spot

Bug1: a multi-repo tick outlasts the tick-start self-sync window, so origin/main moving mid-tick trips assertMainNotStale's refusal for every repo and the daemon wastes the full interval before retrying — withSelfSync now reacts to a tick's own stale-main refusal immediately (opt-in hasStaleRefusal) and restarts instead of waiting. Bug2: review-daemon and reconcile-fix-dispatch-daemon share ONE dedicated clone; whichever self-syncs first merges+restarts, the other reads up-to-date and never restarts, running stale in-memory code for hours — withSelfSync now records HEAD at boot and restarts on ANY drift, not only its own merge.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
