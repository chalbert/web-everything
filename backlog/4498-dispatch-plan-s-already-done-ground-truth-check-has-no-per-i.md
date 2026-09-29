---
bornAs: xp12dod
kind: story
size: 5
parent: "3861"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/soak/breaks/already-done-burst-unattributed.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# dispatch-plan's already-done ground-truth check has no per-item recheck cooldown -- rechecks every stale item via gh pr list every 2-minute tick forever

Live 2026-09-29: this account's shared GraphQL primary budget (identity 'app', ~6100 pts/hr) hit exhaustion 5 times today (the review daemon's own log recorded backoffs until 11:25:36Z, 12:25:37Z, ~13:25Z, ~14:26Z, and 17:26:12Z). gh-throttle's own call ledger (we:scripts/lib/gh-throttle.mjs's calls.jsonl, under the shared gh-admission lock root) shows we:scripts/readiness/dispatch-plan.mjs's 'pr list' op -- the age-gated already-done ground-truth check (isStaleEnoughForGroundTruth / ALREADY_DONE_AGE_GATE_MS in we:scripts/readiness/dispatch-plan.mjs, executed via defaultCheckAlreadyDoneAsync in we:scripts/operations/dispatch-lane-io.mjs) -- as the dominant caller on the exhausted identity today: roughly 10,600 of roughly 14,900 app-identity GraphQL calls (71%), hourly volumes of 2242/4577/2121/3303/3534/2518 calls from 12:00Z-17:00Z. The 17:06:42Z exhaustion that produced the 17:26Z backoff was directly recorded in the identity's own budget-block sidecar file as caller we:dispatch-plan.mjs, op 'pr list'. A same-day fix (PR #2911, 'WE #4415 round 2: route dispatch-plan's already-done burst through gh-throttle', merged 2026-09-29T13:01:20Z, touching we:scripts/operations/dispatch-lane-io.mjs) added caller attribution and the existing gh-throttle concurrency cap to this exact call site, but added no per-item recheck cooldown: once a queued or cleared-but-not-ready item crosses the 2-hour ALREADY_DONE_AGE_GATE_MS threshold, EVERY dispatch-plan tick (every ~120s per we:skills-src/conveyor/runner.mjs's DEFAULT_TICK_INTERVAL_MS) re-issues a fresh 'gh pr list --search' for it, forever, with no memoization of a still-not-done verdict. Direct evidence the fix didn't touch this: hourly volume in the hours AFTER the fix landed (14:00-17:00Z: 2121/3303/3534/2518) was equal to or higher than the hour before it landed (12:00Z: 2242) -- the burst continued unchanged in shape, only now attributed. MVP: add a second, SEPARATE per-item cooldown (a persisted last-checked timestamp keyed by item id, checked before the existing 2h age gate fires the gh call) so an item verified not-yet-done within the cooldown window is skipped instead of rechecked on every tick; the existing 2h gate stays as the entry condition, this adds an exit-rate limiter on top of it. Soak-break proof plan: extend we:scripts/conveyor/soak/breaks/already-done-burst-unattributed.mjs's pattern -- feed a queue with N items already past the 2h age gate across two consecutive ticks and assert the second tick issues zero (or far fewer) already-done gh calls for items checked inside the cooldown window; RED under today's code (repeats N calls every tick), GREEN after.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
