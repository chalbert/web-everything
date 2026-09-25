---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Drain pass: drop the empty-pass repoll under the daemon and persist the head-SHA read cache across passes

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Findings D4, D5, P5 (just speed it up). (1) we:scripts/merge-ai-prs.mjs lines 4954-4957 (delay flag at 3173): when a label-scoped pass finds 0 candidates it sleepSyncs REPOLL_SEC (4 s) and runs a SECOND full sweep. Under the resident daemon (--under-lease) the next pass is 60 s away and nudges exist, so this doubles the cost of the common empty pass (611 of 654 passes today; p50 17.7 s). (2) Lines 3352-3356: ctxReadCache and sweepReadCache are per-process, but the daemon and merge-orphan-sweep spawn a fresh child every pass, so the head-SHA cache never hits: 2 gh calls per open PR, every pass, in every repo. Fix shape: skip the repoll when --under-lease is set; persist the (repo, PR, headSha) read cache under the pinned state root with a size cap, degraded reads still never cached. Done when: unit tests for both; LIVE proof: 20 consecutive empty daemon passes after deploy show p50 at least 40% below today's 17.7 s (history.jsonl ms), numbers in the PR. Coordinate with the drain timing work (PR #2627) and card xulvi8k, which dedupes the context-vs-candidate listing double read; the cache half here must not duplicate it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
