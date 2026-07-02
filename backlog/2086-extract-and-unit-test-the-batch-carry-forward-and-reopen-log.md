---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Extract and unit-test the batch carry-forward and reopen logic from the parallel orchestrator

The carry-forward decision logic (when an item is carried and reopened instead of landed) lives inline in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js — hard to audit, and a bug cascades across 12-plus items per batch as the 2026-07-01 closeout showed. Extract it into a named, unit-tested function with synthetic batch scenarios so the highest-leverage orchestrator failure mode becomes reviewable.

## Progress

- Extracted the closeout reopen decision into pure, tested functions in we:scripts/readiness/carry-forward.mjs: `classifyEntry` (resolved / reopen / foreign), `computeReopenSet` (the deduped, order-preserving reopen list), and `partitionCloseout` (the full one-call summary). Followed the established sandbox pattern (same as we:scripts/readiness/lane-partition.mjs): the Workflow JS sandbox can't `import`, so the module + its test are the SPEC and the workflow inline-MIRRORS it.
- Replaced the inline `toReopen` computation in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js with the mirrored loop + a keep-in-sync pointer to the module. Behavior-identical (un-resolved ∧ claimed-this-run, deduped); the claim-scope boundary (#2072 — never touch a foreign item) is now unit-asserted.
- 14 synthetic-batch tests in we:scripts/readiness/__tests__/carry-forward.test.mjs: all-green, mixed carry/drop, the foreign-item boundary, cross-repo dedup, order determinism, the empty-scope legacy fallback, null-ledger robustness. Green. Workflow body re-parses clean (wrapped-sandbox check); WE gate green.
