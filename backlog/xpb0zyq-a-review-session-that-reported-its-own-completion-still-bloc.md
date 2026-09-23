---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# a review session that reported its own completion still blocks re-dispatch

Live 2026-09-23: after the GitHub rate limit ran out, every dispatched review ended by writing its own completion record (status done, outcome blocked-on-infra) -- but claude agents still lists those sessions as state blocked, and we:scripts/conveyor/reconcile-core.mjs assessLiveness treats only state done as finished. So each such PR stayed bound to a dead reviewer, the review daemon reported 0 owed every tick, and 6 PRs (WE #2513, plateau #174-177, #181) sat review-stalled with no retry even after the rate limit was fixed. Fix: the reconcile IO shell (we:scripts/conveyor/reconcile-pass.mjs) attaches each listed session's completion record (we:scripts/operations/completion-store.mjs, keyed by session name), and a session counts as finished when that record says done AND was updated after the session started (a same-named re-dispatch is never mistaken for the old run). A blocked-on-infra outcome counts as finished only after a 15-minute cool-off, so a persistent outage does not spawn a reviewer every tick.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
