---
bornAs: x3ecgta
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/__tests__/daemon-self-sync.test.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Per-clone reader/writer lock so only one daemon moves a shared clone

Ruling #3681 Fork 4 condition (ii), we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 3. Several daemons share one clone (wev-review-daemon). Each tick takes a shared hold on its clone; the one process that moves the clone takes an exclusive hold, so the tree never moves under a running tick or its children and two daemons never git-merge the same tree at once. A lock failure must not be treated as a merge conflict (today its merge --abort can undo another daemon's merge). Other daemons see the inputs move and restart via the boot-input check.

## Done when

1. **Executable** — `npx vitest run` on we:scripts/lib/__tests__/daemon-clone-lock.test.mjs — fails before (module absent), passes after; includes a two-real-process mutual-exclusion test.

## Delivered

Built as we:scripts/lib/daemon-clone-lock.mjs (reader lease per tick, one writer that waits for readers, same-host dead-pid + TTL reclaim, `hold` CLI for hand operations). Live proof: two daemon processes on one clone — 0 overlapping write spans and 0 `index.lock` errors with the lock, 25-28 overlaps and `index.lock` failures without it.
