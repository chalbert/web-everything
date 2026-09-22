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

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/review-daemon.test.mjs` passes (13/13): every review-kind entry gets dispatched and round-tagged; a failed dispatch is isolated (no round tag, recorded, the tick continues); a failing round/status tag never fails the tick; the status sweep covers both reviews-owed and non-nothing-owed refusals via the injected selectStatusCandidates.
