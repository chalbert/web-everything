---
bornAs: xjx2n2s
kind: task
tier: pinned
parent: "3383"
status: open
dateOpened: "2026-09-01"
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

## Found live 2026-09-03 — a third confirmation, same session

Same overnight #3383 session as the two sections above, now past midnight into 2026-09-03. A dedicated
verification pass checked `claude agents --json` against real GitHub PR history for every live/idle
`conveyor-*`/`prepare-*` session at the time, purely to decide what was actually safe to reap. Result:
finding 1's exact pattern recurred a third time, plus one further variant worth naming on its own.

1. **Five more `working`/idle sessions confirmed stale against merged PRs — finding 1's exact shape,
   recurring.** `prepare-decision-3456` (targeting #3456, resolved via PR #1856), `conveyor-3332b`
   (targeting #3332, resolved via PR #1854), `conveyor-3452` (targeting #3452, resolved via PR #1855),
   `conveyor-3421b` (targeting #3421, resolved via PR #1847), and `prepare-3448` (whose own scope-authoring
   mandate — not #3448 itself, which stays open pending a build — was already covered by PR #1849) were all
   still listed live/idle in `claude agents --json` well after their real work had landed. Each was messaged
   directly rather than force-stopped, asking it to confirm and self-exit; two of the five (`conveyor-3452`,
   `prepare-3448`) replied back within the same session confirming a clean exit with no lease held.

2. **A related but distinct failure mode: the listing itself goes stale even with no stop command
   involved.** Four more sessions in the same scan — `conveyor-3399` (→ #3399, PR #1835), `conveyor-3411b`
   (→ #3411, PR #1837), `prepare-decision-3457` (→ #3457, PR #1856), `prepare-3452` (→ #3452, PR #1855) —
   were also targeting already-merged items, but when the pass tried to message them directly, `SendMessage`
   reported them not reachable at all: they had already exited on their own between the listing being read
   and the message being sent. This is not finding 3's case above (a *stop command's own report* lagging
   reality) — no stop was ever issued here. It's the *listing itself* (`claude agents --json`, unprompted)
   staying stale even for sessions that turn out to already be fully gone, over a much tighter window than
   finding 1's hours-long staleness, but the same underlying "the registry lags reality" shape. Worth the
   builder confirming whether one added liveness probe (does a candidate still respond to a signal/message,
   not just appear in the listing) would catch both this fast-window case and finding 1's longer-window one,
   or whether the two need separate handling.

3. **Operator-observed, not independently verified by this pass: a `claude stop` FAILURE-to-match is not
   proof of exit either — the mirror image of finding 3 above.** After finding 1's five sessions were
   messaged to confirm and self-exit, a follow-up `claude agents --json` read plus `claude stop <sessionId>`
   on all five (including `conveyor-3421b`) came back "No job matching `<id>` — Run `claude agents` to list
   running sessions" for every one, including entries the listing itself still showed `state: "working"` for
   — read at the time as "these are fully gone, just stale-listed." The operator then corrected this
   directly: several of the same named sessions, `conveyor-3421b` specifically, are — from their own
   vantage point — genuinely still connected. So a `claude stop` failure-to-match is not reliable proof of
   exit either; it is the reverse false read from finding 3's "success isn't proof of exit." This one is
   the operator's own observation, not independently re-verified here beyond their word, and is recorded as
   such deliberately. Net for the builder: neither a stop's success NOR its failure-to-match is ground truth
   on its own, in either direction — both need the same independent cross-checks (merged PR, item `status:`,
   lane lease) this card already establishes.

This is the third time finding 1's exact pattern has shown up live in this same overnight session, and the
third distinct way this card has now caught a stop/listing signal lying in some direction — strengthening
this card's own "Done when" #2: it is the ground-truth cross-check against real state — not `claude agents
--json`'s own `state` field, and not a stop command's own report either way — that has to decide what is
safe to reap.
