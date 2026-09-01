---
bornAs: xh0vtzh
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
---

# review-dispatch double-dispatches on every tick instead of respecting a live review session

**Real, confirmed, cost-burning, found live 2026-09-01.** After re-arming two real bounced PRs (`#1764`,
`#1765`) to `review:pending` mid-`#3383` live-fire test, `we:skills-src/conveyor/runner.mjs`'s mechanical
reconcile-pass wiring spawned a NEW independent `review-<pr>` session on nearly every ~120s tick — SEVEN
distinct real PIDs for `#1765` alone over ~15 minutes (confirmed via `claude agents --json`: `pid 7832,
52017, 82075, 93083, 5162, 14244, 26688`, several genuinely co-live at once, not sequential). None of them
ever posted a verdict; the PR's comment thread shows nothing new after the re-arm marker. This directly
contradicts `we:skills-src/conveyor/runner.mjs`'s own docblock claim: "DOUBLE-DISPATCH IS ALREADY GUARDED,
UPSTREAM, NOT HERE... `we:scripts/conveyor/reconcile-core.mjs`'s own liveness read binds a live session to a
PR (cwd → HEAD sha) and refuses (`live-process`) BEFORE the `review` dispatch decision is ever reached." That
guard did not fire here — the runner (and its live loop) had to be killed by hand, and 10 stalled sessions
stopped by hand (`claude stop`, which DID confirm here, unlike the separate stuck-session issue also found
tonight and already noted in this epic's 2026-09-01 doctrine entry), to stop the bleeding. The FIRST review
round for each PR (before any re-arm) completed correctly with a real verdict — the failure mode is specific
to a RE-ARMED PR (`review:changes → review:pending` via `we:scripts/conveyor/rearm-review.mjs`), not the
mechanism in general.

## Done when

1. **Executable** — a regression test on `we:scripts/conveyor/reconcile-core.mjs`'s liveness binding (or
   wherever the actual gap is, once root-caused) that reproduces: a PR re-armed `review:changes → pending`,
   fed through the mechanical pass twice in a row with a still-live review session bound to it, results in
   exactly ONE spawn, not two.
2. Root-cause WHY the liveness bind works for a first-time `review:pending` dispatch but not a re-armed one —
   candidates worth checking first: does the liveness read key off `headRefOid` in a way that a fix's new
   commit invalidates the binding to the STILL-RUNNING prior session; does `we:scripts/conveyor/rearm-review.mjs`
   fail to write/update whatever state the liveness check reads; does each spawn get its own `cwd`/session
   slug in a way `we:scripts/conveyor/reconcile-core.mjs` can never match back to "the same PR."
3. Until fixed, note in this epic's own working doctrine (or the runner's own docblock) that a re-armed PR
   must NOT be left in a running `we:skills-src/conveyor/runner.mjs` loop unattended — this is a real,
   demonstrated cost/safety hazard, not a theoretical one.
