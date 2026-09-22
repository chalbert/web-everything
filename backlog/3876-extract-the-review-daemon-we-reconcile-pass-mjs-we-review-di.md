---
bornAs: xwnbft5
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/review-round-tag.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Extract the Review daemon (we:reconcile-pass.mjs + we:review-dispatch.mjs + tag scripts) to run standalone

Group we:scripts/conveyor/reconcile-pass.mjs + we:scripts/operations/review-dispatch.mjs + we:scripts/conveyor/review-round-tag.mjs + we:scripts/conveyor/review-status-tag.mjs into one standalone Review daemon -- one sequential pass over the same PR, not four things worth separating. we:scripts/operations/review-dispatch.mjs already fences its own dispatch per-PR through we:scripts/operations/action-store.mjs's durable claim ledger (the same mechanism #3870's Fix-dispatch daemon relies on), and it already self-checks main freshness (assertMainNotStale, line 375) -- nothing in the other three scripts' code objects to this grouping running standalone. Blocked on #3860 (routes we:scripts/conveyor/reconcile-pass.mjs's raw gh call through we:scripts/lib/gh-throttle.mjs) purely to avoid the two slices touching the same file out of sequence; not a correctness dependency. Drop the four scripts from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list once baked. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Progress

Built we:skills-src/conveyor/review-daemon.mjs — a standalone loop (same pure-core/IO-shell shape as #3870's Fix-dispatch daemon) that ticks the sequence we:skills-src/conveyor/runner.mjs's own mechanical pass used to run inline: we:scripts/conveyor/reconcile-pass.mjs (discovery, its own fresh gh pr list each tick) into we:scripts/operations/review-dispatch.mjs's dispatchReview per review-kind entry into we:scripts/conveyor/review-round-tag.mjs and we:scripts/conveyor/review-status-tag.mjs (cosmetic). WE-only, matching #3870's own scoping -- the legacy runner's cross-repo (frontierui/plateau-app) iteration and its shared-prs-file optimization are both deliberately NOT replicated (each daemon does its own fetch, an accepted tradeoff of running independently).

Correction found while building: the card's digest said we:scripts/operations/review-dispatch.mjs "already fences its own dispatch per-PR through we:scripts/operations/action-store.mjs's durable claim ledger" -- false on main's actual code (confirmed by direct read: no such import in that file at all). That claim came from an earlier prototype-branch snapshot and did not survive to main. The real double-dispatch protection is upstream, in we:scripts/conveyor/reconcile-pass.mjs / we:scripts/conveyor/reconcile-core.mjs's own liveness read (a PR with a live review-<pr> session is excluded from the next tick's plan) -- the same protection the legacy runner already relied on, inherited here unchanged, not weakened and not newly fixed.

runDaemonLoop is duplicated from #3870's own file rather than imported, since #3870 has not yet landed on main -- a follow-up can dedup the two into one shared file once both exist there.

**Live-caught bug, fixed before this PR merged:** the first real run (started against a live PR the moment this was deployed to a dedicated launchd-managed clone) failed every dispatch with `review-dispatch: --repo  is not a constellation repo`. `runReviewTick` called `dispatch({ pr, repo: null })`, assuming the same "null defaults to we" convention we:scripts/conveyor/reconcile-pass.mjs and we:scripts/conveyor/reconcile-fix-dispatch.mjs use -- but `planReviewDispatch` (inside we:scripts/operations/review-dispatch.mjs) does `String(repo ?? '').trim()` then rejects the resulting empty string; it has no such default. Fixed by passing the real `chalbert/web-everything` slug (already held in the `WE_SLUG` constant, already used for the tag calls) instead of `null`. The unit tests did not catch this because they mocked `dispatch` entirely -- added a regression test that calls the REAL, pure `planReviewDispatch` with the exact value `runReviewTick` produces, so a future reintroduction of `repo: null` fails even if every `dispatch` mock still passes.

**Second live-caught bug, fixed before this PR merged:** deployed to the dedicated launchd-managed clone, the daemon exited cleanly (exit code 0) right after completing its first successful tick instead of sleeping `DEFAULT_INTERVAL_MS` and looping. Root cause: `realSleep`'s `setTimeout(...).unref()` -- `.unref()` tells Node it's fine to exit before that timer fires, and between ticks nothing else keeps the event loop alive (a spawned agent's own stdio is `ignore`d, so no other ref'd handle exists), so the process exited instead of waiting out the sleep. The exact same pattern was independently written into #3870's we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs and we:skills-src/conveyor/pass-daemon.mjs, and fixed the same way in both. Fixed here by removing the `.unref()` (Node's ref'd default is correct for a resident daemon) and exporting `realSleep`. Confirmed by reintroduction: temporarily restoring `.unref()` fails the new regression test (`captured.hasRef()` false); the fix restores it to green. Added a regression test that spies on `global.setTimeout`, captures the real `Timeout` `realSleep` creates, and asserts `.hasRef() === true` -- a mocked-sleep unit test can never catch this class of bug, only a real unmocked timer can.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/review-daemon.test.mjs` passes (15/15): every review-kind entry gets dispatched (with a repo value `planReviewDispatch` genuinely accepts) and round-tagged; a failed dispatch is isolated (no round tag, recorded, the tick continues); a failing round/status tag never fails the tick; the status sweep covers both reviews-owed and non-nothing-owed refusals via the injected selectStatusCandidates; `realSleep`'s own timer stays ref'd (confirmed by reintroduction to fail without the fix).
