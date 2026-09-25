---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/lane-pool.mjs", "we:scripts/lib/free-lane-list.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Shared TOCTOU-safe atomic-write helper (wx-based) for writeQueueFile/writeListCache/writeFreeLaneListAtomic

Live jury finding on PR #2679 (#4122): we:scripts/lib/free-lane-list.mjs#writeFreeLaneListAtomic (now fixed there, wx-based exclusive temp create) used to write its temp file via a plain writeFileSync on a predictable <path>.<pid>.<ms>.tmp name before renaming into place — a pre-placed symlink at that path gets followed and its target overwritten (CONFIRMED live: fs.writeFileSync follows an existing symlink instead of refusing it). The identical pattern is still used by we:scripts/conveyor/queue-store.mjs#writeQueueFile and we:scripts/lane-pool.mjs#writeListCache, both unfixed. Add one shared, audited atomic-write helper (exclusive temp-file create via the wx flag, retry-with-new-name on EEXIST, then rename — the same primitive we:scripts/lane-pool.mjs#writeLeaseAtomic already uses for its own lease marker) and migrate all three call sites to it; consider a check:standards lint rule flagging a writeFileSync-then-renameSync pair outside that helper so a new instance can't reintroduce the same TOCTOU.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
