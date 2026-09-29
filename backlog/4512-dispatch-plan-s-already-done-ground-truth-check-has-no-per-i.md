---
bornAs: xp12dod
kind: story
size: 5
parent: "3861"
status: resolved
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/already-done-cache.mjs", "we:scripts/readiness/__tests__/already-done-cache.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs", "we:scripts/conveyor/soak/breaks/already-done-recheck-burst-no-cooldown.mjs", "we:scripts/conveyor/soak/breaks/already-done-recheck-burst-no-cooldown.soak.test.mjs", "we:scripts/conveyor/soak/breaks/fixtures/already-done-recheck-burst-no-cooldown.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "6d1e54cb86731a98c190aeb908ab58ce94bbef2d"
tags: []
---

# dispatch-plan's already-done ground-truth check has no per-item recheck cooldown -- rechecks every stale item via gh pr list every 2-minute tick forever

Live 2026-09-29: this account's shared GraphQL primary budget (identity 'app', ~6100 pts/hr) hit exhaustion 5 times today (the review daemon's own log recorded backoffs until 11:25:36Z, 12:25:37Z, ~13:25Z, ~14:26Z, and 17:26:12Z). gh-throttle's own call ledger (we:scripts/lib/gh-throttle.mjs's calls.jsonl, under the shared gh-admission lock root) shows we:scripts/readiness/dispatch-plan.mjs's 'pr list' op -- the age-gated already-done ground-truth check (isStaleEnoughForGroundTruth / ALREADY_DONE_AGE_GATE_MS in we:scripts/readiness/dispatch-plan.mjs, executed via defaultCheckAlreadyDoneAsync in we:scripts/operations/dispatch-lane-io.mjs) -- as the dominant caller on the exhausted identity today: roughly 10,600 of roughly 14,900 app-identity GraphQL calls (71%), hourly volumes of 2242/4577/2121/3303/3534/2518 calls from 12:00Z-17:00Z. The 17:06:42Z exhaustion that produced the 17:26Z backoff was directly recorded in the identity's own budget-block sidecar file as caller we:dispatch-plan.mjs, op 'pr list'. A same-day fix (PR #2911, 'WE #4415 round 2: route dispatch-plan's already-done burst through gh-throttle', merged 2026-09-29T13:01:20Z, touching we:scripts/operations/dispatch-lane-io.mjs) added caller attribution and the existing gh-throttle concurrency cap to this exact call site, but added no per-item recheck cooldown: once a queued or cleared-but-not-ready item crosses the 2-hour ALREADY_DONE_AGE_GATE_MS threshold, EVERY dispatch-plan tick (every ~120s per we:skills-src/conveyor/runner.mjs's DEFAULT_TICK_INTERVAL_MS) re-issues a fresh 'gh pr list --search' for it, forever, with no memoization of a still-not-done verdict. Direct evidence the fix didn't touch this: hourly volume in the hours AFTER the fix landed (14:00-17:00Z: 2121/3303/3534/2518) was equal to or higher than the hour before it landed (12:00Z: 2242) -- the burst continued unchanged in shape, only now attributed. MVP: add a second, SEPARATE per-item cooldown (a persisted last-checked timestamp keyed by item id, checked before the existing 2h age gate fires the gh call) so an item verified not-yet-done within the cooldown window is skipped instead of rechecked on every tick; the existing 2h gate stays as the entry condition, this adds an exit-rate limiter on top of it. Soak-break proof plan: extend we:scripts/conveyor/soak/breaks/already-done-burst-unattributed.mjs's pattern -- feed a queue with N items already past the 2h age gate across two consecutive ticks and assert the second tick issues zero (or far fewer) already-done gh calls for items checked inside the cooldown window; RED under today's code (repeats N calls every tick), GREEN after.

## Design

Add a persisted per-item recheck cooldown to `we:dispatch-plan.mjs`'s already-done ground-truth pass, as a
SEPARATE exit-rate limiter layered on top of the existing 2h `ALREADY_DONE_AGE_GATE_MS` entry gate (that gate
stays unchanged). New pure module `we:scripts/readiness/already-done-cache.mjs`, mirroring the sibling
`we:dispatch-pause.mjs`'s pure-core / IO-shell split, fail-open read, and atomic temp+rename write:

- Store: `{ items: { [id]: { checkedAt: <ISO>, done: boolean, pr: object|null } } }`, persisted at
  `we:.conveyor/already-done-cache.json` (env override `WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE`, same pattern
  as `WE_DISPATCH_PAUSE_FILE`). A missing or corrupt file reads as an empty cache (fail open → recheck), never
  as "everything is cached done".
- TWO cooldown windows, asymmetric on purpose (the correctness risk this item must not create): a `done:false`
  entry expires after `ALREADY_DONE_NOT_DONE_COOLDOWN_MS` (default 30 min, env-overridable) — short, because the
  cost of rechecking too soon is one extra `gh` call, but the cost of NOT rechecking a real land is a stuck
  `already-done` hold. A `done:true` entry expires after the much longer `ALREADY_DONE_DONE_COOLDOWN_MS` (default
  24h, env-overridable) — safe to cache longer because it is ONLY ever written from a real `checked:true` verdict
  (never invented by the cache), and a merged PR stays merged.
- A `checked:false` verdict (the `gh` call itself failed/timed out) is NEVER written to the cache — caching a
  failure would let a `gh` outage freeze a stale "not checked" answer past the cache window; the item simply
  stays eligible for the age gate to fire again next tick, exactly like today.
- `we:dispatch-plan.mjs`'s §1.5 ground-truth pass reads the cache once per tick, splits the age-gated-stale id
  set (both `queue` rows and `notReady` ids) into cache-hit (skip the `gh` call, reuse the cached verdict) vs.
  cache-miss (spend the `gh` call, exactly as today), applies verdicts to both populations, records every
  `checked:true` result, and writes the cache back once at the end of the tick.
- `--no-already-done-cache` CLI flag (mirrors the existing `--no-ground-truth` rollback escape hatch) forces a
  full recheck sweep, bypassing the cache read/write for one run — for an operator who needs a fresh sweep
  without waiting out the cooldown.
- The cache WRITE is wrapped in a `try/catch` (best-effort) — a `.conveyor` that's unwritable (read-only
  checkout, full disk, permissions) must never crash a whole dispatch-plan tick just because it could not
  persist a cooldown hint; the read already fails open, and the write now fails soft the same way (added during
  this item's own `/converge` pass, per a real, cheap-to-fix finding four of five review lenses raised
  independently — see the Test plan below for its dedicated coverage).

## MVP (Musts only)

1. `we:scripts/readiness/already-done-cache.mjs` — pure functions (`emptyCacheState`, `parseCacheState`,
   `serializeCacheState`, `isCacheEntryFresh`, `getCachedVerdict`, `recordVerdicts`) + IO shell
   (`resolveAlreadyDoneCacheStorePath`, `readAlreadyDoneCacheState`, `writeAlreadyDoneCacheState`, atomic write,
   fail-open read) + `ALREADY_DONE_NOT_DONE_COOLDOWN_MS` / `ALREADY_DONE_DONE_COOLDOWN_MS` + their env overrides.
2. Wire into `we:dispatch-plan.mjs`'s §1.5 ground-truth pass exactly as described in Design above, covering BOTH
   the `queue` rows and the `notReady` ids.
3. `--no-already-done-cache` flag.
4. Update `we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs` to point
   `WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE` at an isolated per-test tmp path — otherwise this test starts
   reading a real, shared on-disk cache once the cooldown ships and can false-pass/flake across repeated runs.
5. New `we:scripts/readiness/__tests__/already-done-cache.test.mjs` — unit coverage of the pure cache functions
   (fresh/expired for both `done` and not-`done`, fail-open parse of missing/corrupt state, atomic write).
6. A new case in the bounded-spawn test file (or a sibling) that runs the fixture TWICE back-to-back against the
   SAME isolated cache file and asserts the second run's `gh pr list --search` spawn count is 0.
7. New soak break `we:scripts/conveyor/soak/breaks/already-done-recheck-burst-no-cooldown.mjs` (+ its
   `we:already-done-recheck-burst-no-cooldown.soak.test.mjs` + fixture, following
   `we:already-done-burst-unattributed.mjs`'s pattern) — runs `we:dispatch-plan.mjs`'s real CLI twice
   back-to-back against a fixture backlog of N age-gated-stale items with a fake `gh`; `fixPresent` reads for
   the cache module's own marker. Picked up by the existing directory discovery — no `we:index.mjs` edit needed.

## Test plan (each fails before the fix, on today's `main`)

- `we:already-done-cache.test.mjs` — new file, entirely new assertions; fails today because the module doesn't
  exist.
- The new "second run makes zero already-done calls" case in the bounded-spawn test — fails today: the second
  run repeats the full N `gh pr list` calls, identical to the first (this is the exact live bug).
- `already-done-recheck-burst-no-cooldown` soak break — `fixPresent(root)` is false against today's tree, so the
  break runs EXPECTED-FAIL (reproducing the violation: second tick still spawns N calls); flips to a required
  GREEN pass the moment the fix lands.
- Three additional bounded-spawn cases, added during `/converge` to close a coverage gap the review found (the
  cache-HIT `done:true` replay path, the `--no-already-done-cache` bypass, and the unwritable-store fail-soft
  path, were all exercised only at the pure-module level before this): a cached `done:true` verdict replays
  `alreadyDonePr` end to end on a second run with zero extra `gh` calls for that id; `--no-already-done-cache`
  spends the full N calls on EVERY run (never a bypass-that-reads-an-empty-cache-and-still-looks-like-a-skip);
  and an unwritable cache store (a file where the store's directory should be) never crashes the tick and never
  materializes a cache file, still spending the full N calls. All three fail before this item's fix exists.

## Proof plan (live before/after)

- Before: `gh api rate_limit` snapshot, plus a window of gh-throttle's own ledger attribution to dispatch-plan's
  `pr list` op (calls/hour) — the same evidence class this card's own trace used.
- Scratch dry-run from the lane: run the planner twice back-to-back (`node we:scripts/readiness/dispatch-plan.mjs
  --json` against a live/staging queue, or `we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run`) and
  count the already-done `gh pr list --search` calls each run made (via gh-throttle's own call log).
- After: the second run's already-done call count is ≈0 (all age-gated-stale ids hit the cooldown cache); `gh
  api rate_limit` shows no incremental spend from that pass on the second run.
- Soak break: reverting the cooldown (or running the pre-fix source) makes the second run issue the full N calls
  again (RED); with the fix in place it is GREEN.

## Follow-ups (file as cards, out of this MVP)

- Batch the ground-truth check into one wide `gh pr list --state merged` page scanned in-process for every
  stale id in a tick, instead of one `gh pr list --search` per id — would drop the cache-miss cost from
  O(stale ids) to O(1) per tick. Not needed for THIS item (the cooldown alone should cut volume by >90% on its
  own, per the Proof plan); file separately if live proof after this lands still shows a material miss-set.
- A state-change-triggered cache invalidation (recheck immediately on re-claim, rather than waiting out the
  cooldown) was considered and dropped from this MVP: the existing 2h age gate already makes "past the age gate
  AND freshly re-claimed within the same cooldown window" a rare combination with no live case yet: adding a
  second invalidation axis now would add correctness surface (comparing item state at cache-write time vs.
  read time) for a case not observed. File if a live case later shows the cache holding a stale answer across
  a real state change.
- The sibling card filed from the same 2026-09-29 trace, `we:backlog/4497` (gh-throttle logs a hardcoded
  default GraphQL cost per call instead of GitHub's real reported cost) is a SEPARATE item, not folded in here.
- The cache store is never pruned (a `/converge` red-team finding, carved out as parallelizable/non-blocking):
  an id that leaves the queue (resolved, dropped, or moved off the age gate) keeps its entry in
  `we:.conveyor/already-done-cache.json` forever, and the whole file is rewritten every tick regardless of size.
  In practice this stays small (bounded by "items ever seen past the 2h age gate", not by history), but a
  follow-up could prune entries for ids no longer in the live queue on each write. Not needed for THIS item's
  correctness or its proof (the live before/after numbers), so left as a separate card if the file's size ever
  becomes a real operational concern.

## Done when

1. **Executable** — running the fixture-mode `we:dispatch-plan.mjs` CLI twice back-to-back against the same
   isolated already-done cache file shows the second run's `gh pr list --search` (already-done) spawn count
   drop from N to 0 — RED on today's `main`, GREEN after this item's fix (the new bounded-spawn test case +
   the new soak break both encode this).
2. `we:already-done-cache.mjs`'s pure functions are unit-tested for both cooldown windows, the fail-open parse
   path, and the atomic write.
3. `already-done-recheck-burst-no-cooldown` soak break is registered under
   `we:scripts/conveyor/soak/breaks/` and passes `npm run test:soak`.
4. `check:standards` is green on the touched scope.
