---
bornAs: xo83x9i
kind: story
size: 3
parent: "3383"
status: active
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
tags: []
scope:
  - we:scripts/conveyor/
  - we:scripts/operations/
  - we:scripts/operator/
  - we:scripts/readiness/
  - we:scripts/lib/
  - we:scripts/guard-bash.mjs
  - we:scripts/lane-pool.mjs
  - we:scripts/verify-lane.mjs
  - we:scripts/__tests__/
  - we:skills-src/conveyor/
  - we:backlog/
---

# Graduate origin/lane/mechanical-dispatcher to main in small, independently reviewable pieces

origin/lane/mechanical-dispatcher (38 ahead of main, drifts session to session) has accumulated the conveyor runner/dispatch-loop infrastructure via direct pushes, not reviewed PRs -- every #3383 session update has flagged eventual graduation but never started it. Tracks that ongoing graduation: land stable, inert pieces first (e.g. the we:scripts/conveyor/review-round-tag.mjs / we:scripts/conveyor/review-status-tag.mjs informative PR labels, standalone with no we:skills-src/conveyor/runner.mjs wiring); hold back the reconcile-pass runner wiring (the continuous review-dispatch loop, commit 186801a0) until #3437's fix lands on main. Covers the whole ongoing effort, not one PR.

## Done when

1. **Executable** — `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` reports `0` on the right (lane-branch-ahead) side: every commit unique to `origin/lane/mechanical-dispatcher` has landed on `main` through its own small reviewed PR, or this item is resolved with an explicit note naming which remaining commits were deliberately dropped/superseded and why.
2. The reconcile-pass runner wiring that dispatches `review`/`fix` continuously on a tick loop (`origin/lane/mechanical-dispatcher`'s `186801a0` and anything layered on it) is not cherry-picked to `main` until `git log main -- we:scripts/conveyor/reconcile-core.mjs` shows the `#3437` name-based-bind fix (or `backlog/3437-*.md` is `status: resolved`) — landing the continuous loop before that fix would reproduce `#3437`'s live double-dispatch bug on `main`'s own runner.
3. Each landed increment is its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline — never a bulk merge of the branch, and never a direct push to `main`.

## Progress

- 2026-09-03: Landed `computeFreeSlots` dirty-lane exclusion (`origin/lane/mechanical-dispatcher`'s `c7316eb40`,
  hand-reapplied onto `main`'s current `we:scripts/readiness/conveyor-state.mjs` — the branch commit didn't
  cherry-pick clean, main had independently diverged elsewhere in the same file). Confirmed already-landed via
  separate PR (content-identical, different commit shape): `26b6bbe4b`/`e603e919f`/`5c75464c1`
  (review-round-tag/review-status-tag) and `7d7e398b6`/`4d5d98365`/`d4fa4667f` (dispatch-lane fix/ci-heal
  widening, landed under #3332 instead). Still ahead on `origin/main...origin/lane/mechanical-dispatcher`:
  ~26 commits, most entangled with the held-back reconcile-pass tick-loop wiring (`186801a04`+) or with
  `we:skills-src/conveyor/supervisor.mjs` (doesn't exist on `main` yet — a bigger follow-on piece, not this PR's
  target). Next standalone candidates identified for a future increment: `we:scripts/verify-lane.mjs` request/check mode +
  `we:scripts/conveyor/verify-dispatch.mjs` (`3faf739c5` — bigger, multi-concern), `34302e2c3` (lane-pool retry
  fetch), `d37731fd7` (lane-pool flag validation).

- **2026-09-04 (recon/planning session, no build).** The branch was reconciled with `main` earlier tonight
  (a prior session took it from 97-behind/42-ahead to 0-behind, pushed as `3e4383f1c`) — this rewrote every
  commit SHA on the branch, so **every specific hash named in the 2026-09-03 entry above is now stale**; treat
  it as historical narrative only, not a lookup key. Fresh ground truth, taken right now:
  `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` → `0` behind, **30**
  ahead (not the "~26" estimated pre-reconciliation) — 46 files, +4645/-194.

  **`#3437` is confirmed `status: resolved`, and its name-based-bind fix
  (`bind review-dispatch sessions by session name, not just cwd/HEAD-oid`) is confirmed present on `main` in
  `we:scripts/conveyor/reconcile-core.mjs` today** — this item's own Done-when #2 gate is satisfied, so the
  reconcile-pass runner wiring is no longer held back; it is simply not yet sliced/landed.

  Of the 30 commits: one (`aa8c8823d`, review-round-tag/review-status-tag labels) is confirmed superseded —
  identical content already landed on `main` under a different SHA, nothing to do. One (`c30fe565b`,
  dispatch-lane fix/ci-heal widening) turns out to touch only a test file on the branch — the widening itself
  is already on `main` (landed under #3332 per the entry above); only its residual test coverage is still
  missing, folded into the dispatch-lane-hardening slice below. One (`d23678688`) is a pure merge commit
  (`we:package-lock.json` only), and one revert pair (`d281428c2`/`c24db21dd`, a live-fire test of #3412) nets
  to zero — both ignorable. Eight commits (`3003410fd`, `a2e528c14`, `4f1b19e0b`, `a178cffd0`, `2242b54b0`,
  `7793ce938`, `bbe23dcd3`, `fa3315eae`) are session-log edits to `we:backlog/3383-*.md` and
  `we:backlog/3105-*.md` — branch-local narrative that doesn't cherry-pick cleanly onto `main`'s
  independently-evolved #3383 card; not proposed as a graduation slice, any still-relevant findings should be
  folded into `main`'s #3383 card by hand as normal session-update hygiene. Two (`ef1120a32`, `011a9b912`,
  "session-reaper: ...") touch only a test file with no matching implementation change in this range —
  low-value, not sliced separately.

  **The remaining ~18 commits group into 7 slices, filed as real child stories under this item** (JIT-numbered
  hashes below; the drain assigns their `#NNN` at land):

  1. `we:scripts/lane-pool.mjs` hardening (fetch-race retry, flag validation) + `we:scripts/lib/lane-lease.mjs`
     — **we:backlog/3481-*** — standalone, unblocked, ready to build now.
  2. `we:scripts/verify-lane.mjs` request/check gate mode + `we:scripts/conveyor/verify-dispatch.mjs` (the
     "wait primitive" fork of #3105's still-open footgun decision) — **we:backlog/3484-*** — standalone,
     unblocked, ready to build now.
  3. `we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-lane-io.mjs` hardening
     (attempt-tagging retries #3110, residual fix/ci-heal test coverage, `WE_DISPATCH_KIND` wiring) —
     **we:backlog/3488-*** — `blockedBy: 3484` (slice 2 above; it stamps the env var slice 3 reads).
  4. Core reconcile-pass payload, split into 3 landing-ordered parts since it's the epic's largest, most
     entangled body of work: (a) `we:scripts/operations/route-pr-outcome.mjs` and
     `we:scripts/operations/route-pr-outcome-io.mjs` (new) — **we:backlog/3482-***, unblocked; (b)
     `we:skills-src/conveyor/supervisor.mjs` (new standalone daemon) — **we:backlog/3483-***,
     `blockedBy: 3482`; (c) the `we:skills-src/conveyor/runner.mjs` wiring that actually activates the
     continuous reconcile-pass tick loop — **we:backlog/3486-***, `blockedBy: 3482, 3483` — this is
     the piece Done-when #2 was gating, now unblocked by #3437, but it should still get the most scrutiny of
     any slice here and land last, validated with a single manual tick before any continuous loop runs against
     it (mirroring #3437's own Done-when #4 caution).
  5. `we:scripts/conveyor/tick-core.mjs` durable build-guard-floor fix + supervisor/runner crash-loop and
     idle-with-queue alerting hardening (#3398/#3403/#3404/#3406/#3416) — **we:backlog/3487-***,
     `blockedBy: 3483, 3486` (these are fixes layered on top of the new supervisor/runner machinery, not
     separable from it in the branch's own commit history).
  6. Follow-up (not a graduation slice, a fresh child of slice 2): fold the gate's request/check modes into the
     declared `we:scripts/operations/verify.mjs` operation, per #3224 — already fully drafted, unlanded, on the
     branch as `we:backlog/xab3jh7-*`; re-filed here as a real numbered child rather than cherry-picked
     verbatim — **we:backlog/3485-***, `blockedBy: 3484`.

  Slices 1 and 2 above are queued into the live conveyor tonight (2026-09-04) — see their own cards. Slice 3
  and the three parts of slice 4/5 are filed but intentionally NOT queued yet: their `blockedBy` edges mean
  the conveyor can't dispatch them until their prerequisite lands, and slice 4(c) in particular needs a human
  or a very deliberate agent turn at land time, not blind automated dispatch.
