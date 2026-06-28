---
kind: epic
status: open
dateOpened: "2026-06-28"
tags: []
---

# Raise parallel-batch concurrency: adopt the optimistic-floor model in the orchestrator's partition

The clone orchestrator (#1933) shipped the lock blacklist (RESERVED_MERGE_RISK + #1945 per-file locks) and the optimistic git-merge floor (#1935 Option D: rebase-retry, serial-replay, multiLaneFiles), but its PARTITION step never adopted them — it still pre-serializes whole items on predicted-file overlap and a conservative 'confident:false' flag (which fires on any shared-surface risk incl. build config). Result: batch-2026-06-28-1946-1945 ran 8 provably-pairwise-disjoint items fully SERIAL (0 concurrent lanes) — #1946/#1908/#1941/#1945 had disjoint real touch-sets and could have run as 4 lanes. This epic flips the partition optimistic-first so serial is forced only by a real blockedBy edge or same-blacklist-file contention; everything else runs concurrent + merge-resolved. Children: A (optimistic-first partition), B (cross-repo blacklist+locks), C (demote build-config off the monolith trigger).
