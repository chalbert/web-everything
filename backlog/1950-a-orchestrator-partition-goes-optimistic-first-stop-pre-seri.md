---
kind: story
size: 5
parent: "1949"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-29"
tags: []
---

# A: orchestrator partition goes optimistic-first (stop pre-serializing on predicted overlap)

Flip the clone orchestrator's partition (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) from pessimistic to optimistic-first. Today collide(x,y)=any predicted-file overlap forces serial, and the probe's confident:false (any shared-surface risk) forces serial — so genuinely-independent items collapse to one serial chain (batch-2026-06-28-1946-1945: 8 items, 0 lanes). New rule: an item is forced serial ONLY by (a) a real blockedBy edge to another batch item, or (b) contention with another item on the SAME blacklist file (RESERVED_MERGE_RISK) — and even (b) prefers the per-file lock (#1945) over whole-item serial. Shared-but-non-monolith files (build config, barrels, shared specs) run CONCURRENT and lean on the optimistic floor (rebase-retry + serial-replay + multiLaneFiles) that already exists. Reliability floor unchanged: serial-replay still catches any real surviving conflict. Update the probe schema so confident/touchesMonolith drive locking, not blanket serialization; add unit coverage for the new partition predicate.

## Progress

- 2026-06-28: Done. Extracted the pure partition predicate into the canonical, tested module `we:scripts/readiness/lane-partition.mjs` (`mustSerialize`/`conflicts`/`partition`/`mergeRiskFilesOf`/`serialReason`) — the orchestrator sandbox can't `import`, so `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` inline-MIRRORS it (sync note in both). New model: serial only on (a) failed probe, (b) blockedBy edge, (c) a shared **merge-risk (blacklist) file**, or (d) a low-confidence item overlapping another on any file; confident items sharing only ordinary files (build config, barrels, own spill) run concurrent under the optimistic floor. Dropped the old `confident:false → serial` and `any-overlap → serial` gates; `mustSerialize` now only fires on a probe-less item. Updated the probe schema/prompt + the partition/serial-reason log lines + the skill's non-negotiable #2 (`we:.claude/skills/batch-backlog-items/SKILL.md`) + the workflow header contract. Proof: `we:scripts/readiness/__tests__/lane-partition.test.mjs` (19 cases) including the headline regression — the 4 pairwise-disjoint items batch-2026-06-28-1946-1945 ran serial now partition into 4 concurrent lanes. `check:standards` green; workflow ESM syntax verified. Follow-ons: B (#1951, cross-repo blacklist+locks), C (#1952, demote build config off the merge-risk set).
