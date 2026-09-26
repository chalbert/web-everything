---
bornAs: xa1ex02
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/operations/__tests__/runner-activity-io.test.mjs", "we:scripts/__tests__/lane-pool-acquire-shares-scan-cache.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Make load-sensitive timing tests deterministic (verify-dispatch, runner-activity-io, lane-pool-acquire-shares-scan-cache)

ci-heal-2721's local full-suite gate (required by PR #2721 touching we:vitest.config.ts) went red twice on unrelated timing tests that each pass alone under load. Root cause in we:scripts/conveyor/__tests__/verify-dispatch.test.mjs, we:scripts/operations/__tests__/runner-activity-io.test.mjs and we:scripts/__tests__/lane-pool-acquire-shares-scan-cache.test.mjs: fixed wall-clock bounds/sleeps with too little headroom over real subprocess spawn/kill overhead, and missing it()-level timeout overrides that let vitest's 5000ms default race real git/subprocess work. Fix: generous, reasoned outer wall-clock ceilings (never the code's own internal timeout constants), a poll-based proof instead of a single delayed setTimeout check, and a real-timestamp-anchored sync for one admission-contention race found while proving this under load.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
