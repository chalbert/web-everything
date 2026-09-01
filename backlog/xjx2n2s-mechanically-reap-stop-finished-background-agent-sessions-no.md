---
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
---

# Mechanically reap/stop finished background agent sessions -- nothing does this today

Found live 2026-09-01: `claude agents --json` accumulates every dispatched review/fix/build session
indefinitely — a finished (`state: done`) one is never deregistered on its own. By the end of tonight's
live-fire test, 12 finished `review-1764`/`review-1765` sessions plus 4 stale `conveyor-*` sessions from
earlier in the night were all still listed; every one had to be stopped by hand, one `claude stop <id>` call
at a time. The operator, 2026-09-01: "make sure we close session when they are done... need to be
mechanically done in future." No existing mechanical pass does this — `we:scripts/conveyor/lease-reaper.mjs`
reaps LANE leases, not `claude agents` session registrations, which is a separate resource entirely. Left
undone, every real review/fix dispatch this epic's own mechanism runs adds one more permanent entry to the
listing, and the growing list itself became a real diagnostic obstacle tonight (a stray `done` row for a
long-finished session is easy to mistake for one still relevant).

## Done when

1. **Executable** — a new mechanical pass (mirroring `we:scripts/conveyor/lease-reaper.mjs`'s own shape,
   wired into `we:skills-src/conveyor/runner.mjs` the same way) reads `claude agents --json`, and for every
   entry whose `state` is a terminal one (`done` at minimum — confirm whether any other state this epic's own
   dispatches produce is also terminal) and whose PR/purpose is no longer relevant (the PR merged, or the
   session's own review/fix round already produced a labeled outcome), calls `claude stop <id>` on it.
2. A real test proves a fabricated `claude agents --json` listing with a mix of `working`/`blocked`/`done`
   rows only stops the `done` ones — never a live one, never a `blocked` one (a stuck session needs the
   separate, still-open stuck-session-cleanup gap this epic already named, not a blind reap).
3. Best-effort, matching every other mechanical pass in this loop: one session's stop failing (the same
   "couldn't confirm, background service may be restarting" flakiness found live tonight) never blocks the
   rest of the pass or the tick.
