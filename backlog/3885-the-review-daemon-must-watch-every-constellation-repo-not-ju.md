---
bornAs: xvyuwtg
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs", "we:.gitignore"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# the Review daemon must watch every constellation repo, not just WE

Live-caught 2026-09-22: plateau-app PR #167 sat review:pending with nothing watching it -- we:skills-src/conveyor/review-daemon.mjs's own tick only ever calls reconcile with repo=null (defaulting to WE), so a PR in frontierui or plateau-app is never discovered, even though every downstream step is already fully repo-generic and proven working live (we:scripts/conveyor/reconcile-pass.mjs already accepts --repo end to end, we:scripts/operations/review-dispatch.mjs already dispatched plateau-app#167's review successfully once run from a clean, non-lane, up-to-date WE checkout -- dispatch was never actually coupled to a target repo's own checkout being fresh; we:scripts/lane-pool.mjs derives the ORIGIN URL from --repo=<path> and clones fresh from there, it does not reuse that path's own ref state). The only real gap is discovery: the daemon's tick needs to loop over a list of constellation repos, not just WE. Fix: add a REVIEW_DAEMON_REPOS list (seeded from CONSTELLATION_REPOS's three repos today; kept as data so a future configurable per-user repo list is a source swap, not a redesign) and a per-repo tick loop, isolating one repo's failure from the others (a plateau-app gh outage must not stop WE's own reviews). Also fixes a small related bug found while doing this by hand: we:.gitignore has no .conveyor/*.log entry, so a review-daemon dedicated clone's own log output makes its checkout look permanently dirty to git, which blocks the checkout's own staleness auto-fast-forward (we:scripts/lib/main-staleness.mjs's cleanOnly auto-ff requires a clean tree) -- had to fast-forward wev-review-daemon by hand for this exact reason immediately before filing this item.

## Progress

Fixed a second, related bug found while building this: `runReviewTick`'s `repo` param reached `dispatch`/`tagRound`/`tagStatus` but was NEVER passed to `reconcile` (called as `reconcile({})` unconditionally) — so even with the multi-repo loop added, every repo's tick would have kept discovering WE's own PRs. Fixed by calling `reconcile({repo})`. Confirmed by reintroduction: the new regression test fails against the pre-fix `reconcile({})` call and passes with the fix.

Added `REVIEW_DAEMON_REPOS` (today: `Object.values(CONSTELLATION_REPOS).map(r => r.slug)`) and `runReviewTickAllRepos`, which calls the existing `runReviewTick` once per watched repo, isolating one repo's failure from the rest (mirrors the existing per-PR isolation one level down). Wired into `buildCliDaemonEffects`'s `tickOnce`.

Manually proved the underlying dispatch path works correctly for a non-WE repo before writing any of this: dispatched plateau-app PR #167's review by hand (`node we:scripts/operations/review-dispatch.mjs --pr=167 --repo=chalbert/plateau-app`) from the dedicated `wev-review-daemon` clone once it was clean and fresh -- succeeded (agent c857b329, slug review-pa-167). This corrected an earlier, wrong assumption (recorded and then retracted mid-session) that dispatch itself needed a per-target-repo dedicated-checkout architecture; it does not -- we:scripts/operations/review-dispatch.mjs's own staleness check runs against the DISPATCHING checkout only (always the WE checkout dispatch is invoked from), and we:scripts/lane-pool.mjs's acquire --repo=<path> derives the origin URL from that path and clones fresh from GitHub, never reusing the path's own (possibly stale/dirty) ref state.

Added .conveyor/*.log to we:.gitignore: the daemon's own log output was making its dedicated clone look permanently dirty to git, which silently defeated that checkout's own staleness auto-fast-forward and required a manual git merge --ff-only before the plateau-app dispatch above could even run.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/review-daemon.test.mjs` passes (21/21): `REVIEW_DAEMON_REPOS` contains all three constellation repos; `reconcile` is called with the same `repo` a tick was given (confirmed by reintroduction to fail without the fix); `runReviewTickAllRepos` ticks every watched repo, tags each dispatched/failed entry with its own repo, isolates one repo's throw from the rest, forwards every non-`repo` option to each tick, and defaults to `REVIEW_DAEMON_REPOS`.
