---
bornAs: xwnbft5
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3860"]
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/review-round-tag.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Extract the Review daemon (we:reconcile-pass.mjs + we:review-dispatch.mjs + tag scripts) to run standalone

Group we:scripts/conveyor/reconcile-pass.mjs + we:scripts/operations/review-dispatch.mjs + we:scripts/conveyor/review-round-tag.mjs + we:scripts/conveyor/review-status-tag.mjs into one standalone Review daemon -- one sequential pass over the same PR, not four things worth separating. we:scripts/operations/review-dispatch.mjs already fences its own dispatch per-PR through we:scripts/operations/action-store.mjs's durable claim ledger (the same mechanism #3870's Fix-dispatch daemon relies on), and it already self-checks main freshness (assertMainNotStale, line 375) -- nothing in the other three scripts' code objects to this grouping running standalone. Blocked on #3860 (routes we:scripts/conveyor/reconcile-pass.mjs's raw gh call through we:scripts/lib/gh-throttle.mjs) purely to avoid the two slices touching the same file out of sequence; not a correctness dependency. Drop the four scripts from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list once baked. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
