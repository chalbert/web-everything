---
bornAs: xjx2n2s
kind: task
parent: "3383"
status: active
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
tags: []
scope:
  - we:skills-src/conveyor/runner.mjs
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/dispatch-abort.mjs
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

## Found live 2026-09-02 — four more failure patterns from a later long #3383 session

Same epic, a different long live-fire session, produced four concrete cases a mechanical reaper has to get
right. These aren't hypotheticals — each one actually happened and would have broken a naive implementation
of the "Done when" above.

1. **`working` in the listing, but actually long finished.** `conveyor-3399`, `conveyor-3411b`,
   `prepare-3454`, and 11 much-older sessions from earlier that night all kept reporting `state: "working"`
   in `claude agents --json` for hours after their real work had already landed as merged PRs. The `state`/
   `status` fields `claude agents` reports are not reliable on their own — a reap check needs to cross-check
   ground truth before deciding a session is safe to reap: does a merged PR already exist referencing this
   item? does the item's own `status:` read `resolved`? does the session still hold a lane lease?

2. **`blocked` in the listing, but actually just hadn't started its arc yet.** `prepare-3447`, `review-1834`,
   and `review-1836` all showed as `blocked` for a long stretch, but once pinged, turned out to have simply
   never begun their dispatch brief — one message woke each of them into immediately doing real work. A
   reaper must not treat `blocked` as automatically "stuck, kill it"; it needs to distinguish a genuine stall
   from a session that's alive but idle pending its next nudge (this is the same distinction Done-when #2
   already draws, now with a named failure mode: `blocked` can mean "hasn't started," not "can't proceed").

3. **`claude stop` reporting success is not proof the session is gone.** Confirmed against real, filed
   upstream Claude Code bugs (`anthropics/claude-code` issues #65925, #45250, #41461): `claude stop <id>` can
   report success while the session continues to list as `working` locally indefinitely — the local CLI
   listing doesn't reconcile with server-side state after a stop. A mechanical reaper can't trust its own
   stop command's reported success as proof a session is actually gone; it needs an independent signal (e.g.
   confirming the session no longer appears in a subsequent listing), and should treat "stop reported
   success" as a hint, not a certainty.

4. **Long-idle-looking sessions that are genuinely still working must not be falsely reaped.**
   `conveyor-3332` and `conveyor-3421c` ran 65-80 minutes showing `idle`/`busy` between infrequent status
   updates, but were doing real, careful work the whole time: implement, gate, adversarial self-review, find
   and fix real bugs, reverify, converge. That's a legitimately long, multi-round cycle that looks idle from
   the outside (no visible progress between notifications) but isn't remotely stuck. A pure "idle past N
   minutes = reap" heuristic would have wrongly killed real, valuable work in both cases.

Net for whoever builds this: the `state`/`status` fields `claude agents --json` reports are necessary
signals but not sufficient ones in either direction — `working`/`blocked` can lag or mislabel a session
that's actually done or actually fine, and a stop's own success report can lag a session that's actually
gone. Ground-truth cross-checks (merged PR, item `status:`, lane lease, a follow-up listing) are load-bearing,
not optional polish.
