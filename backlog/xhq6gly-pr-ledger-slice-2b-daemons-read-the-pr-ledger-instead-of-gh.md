---
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["x0lxgal"]
scope: ["we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/lib/pr-snapshot.mjs", "we:scripts/lib/pr-events.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# PR ledger slice 2b: daemons read the PR ledger instead of gh pr list

Slice 2 of webhooks-not-polling. Once x0lxgal serves per-PR derived state, switch discovery in the review daemon (we:skills-src/conveyor/review-daemon.mjs), the fix/ci-heal daemon (we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs) and the shared open-PR snapshot (we:scripts/lib/pr-snapshot.mjs) to read the ledger (one Worker call) and only fall back to gh when the feed is stale (the pr-events-stale smell / classifyFeedHealth in we:scripts/lib/pr-events.mjs). Goal: near-zero GraphQL spend at steady state; the per-PR gate re-derive before any mutation stays on GitHub (wake-only / authority stays server-side, we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
