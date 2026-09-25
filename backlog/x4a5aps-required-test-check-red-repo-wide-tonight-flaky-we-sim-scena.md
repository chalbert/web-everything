---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs", "we:scripts/conveyor/__tests__/sim/scenario.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Required 'test' check red repo-wide tonight: flaky we:sim-scenario-self-sync-sibling.test.mjs (I-15/I-18) blocks every PR

we:scripts/conveyor/__tests__/sim-scenario-self-sync-sibling.test.mjs (added by PR #2623, xitk240, #3383's daemon scenario simulator) is failing the required 'test' GitHub Actions check's 'Real-git integration suite' step on multiple unrelated PRs simultaneously tonight (2026-09-24/25) -- confirmed on #2630 (since closed), #2634 (unrelated: daemon blocking antipatterns audit) and #2635 (docs-only: two backlog .md files, zero code). Both failing cases assert a specific tick's fixTicks[1].restart is true and get undefined instead (we:scripts/conveyor/__tests__/sim/scenario.mjs:349, runScenario). Since it reproduces identically across PRs with disjoint diffs, the test itself (or the daemon-tick simulator machinery it drives) is flaky/timing-sensitive under CI's current load, not a real regression in any of the blocked PRs' own content. Blocks the whole graduation epic #3443's landing pipeline (every PR's required 'test' check is red) until fixed or quarantined. Investigate we:scripts/conveyor/__tests__/sim/scenario.mjs's tick-timing determinism under CI concurrency; if genuinely flaky, quarantine (skip with a tracking comment) rather than leave the whole repo's required check red.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
