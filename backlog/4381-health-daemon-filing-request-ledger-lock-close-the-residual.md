---
bornAs: xbedfjd
kind: story
size: 2
parent: "4075"
status: open
blockedBy: ["4079"]
scope: ["we:scripts/conveyor/health-file-request.mjs"]
dateOpened: "2026-09-28"
tags: [health-daemon]
---

# Health daemon filing-request ledger lock: close the residual check-then-act stale-reclaim race

#4079's we:scripts/conveyor/health-file-request.mjs#withLedgerLock reclaims a stale lock via an atomic renameSync keyed to a FIXED path (lockPath), not the specific inode/mtime a waiter actually inspected as stale. Two waiters can still both observe a lock as stale and race: the loser's rename can target a lock a THIRD process legitimately just (re)created, not the one it inspected, in the narrow window between the stale-check stat and the rename. This is bounded (a live holder's own lock is only stale after staleMs=60s, far longer than the tiny read-modify-write the lock actually guards) and accepted as a known residual for #4079's MVP rather than solved with heavier machinery.

Fix properly: add a generation/token check so a reclaim only succeeds if the file's content still matches what was inspected (read+verify content before renaming, or a proper compare-and-swap lock primitive).

## Done when

1. **Executable** — a test drives two concurrent reclaimers plus a THIRD process that recreates the lock inside the window between one reclaimer's stale-check and its rename, and proves only the process holding the content/generation-matched lock ever enters the critical section (the other reclaimer's rename must be refused, not silently succeed against the wrong lock).
2. **No regression** — the existing `withLedgerLock` single-winner and mutual-exclusion tests in `we:scripts/conveyor/__tests__/health-file-request.test.mjs` still pass unchanged.
