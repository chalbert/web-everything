---
kind: story
size: 5
parent: "1949"
status: open
dateOpened: "2026-06-28"
tags: []
---

# A: orchestrator partition goes optimistic-first (stop pre-serializing on predicted overlap)

Flip the clone orchestrator's partition (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js) from pessimistic to optimistic-first. Today collide(x,y)=any predicted-file overlap forces serial, and the probe's confident:false (any shared-surface risk) forces serial — so genuinely-independent items collapse to one serial chain (batch-2026-06-28-1946-1945: 8 items, 0 lanes). New rule: an item is forced serial ONLY by (a) a real blockedBy edge to another batch item, or (b) contention with another item on the SAME blacklist file (RESERVED_MERGE_RISK) — and even (b) prefers the per-file lock (#1945) over whole-item serial. Shared-but-non-monolith files (build config, barrels, shared specs) run CONCURRENT and lean on the optimistic floor (rebase-retry + serial-replay + multiLaneFiles) that already exists. Reliability floor unchanged: serial-replay still catches any real surviving conflict. Update the probe schema so confident/touchesMonolith drive locking, not blanket serialization; add unit coverage for the new partition predicate.
