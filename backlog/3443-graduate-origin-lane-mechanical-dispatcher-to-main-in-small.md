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
