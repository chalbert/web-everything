---
kind: task
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Fix claim-time isDirty false-positive — ignore untracked (??) files

The pre-claim guard in `we:scripts/backlog.mjs` (`isDirty` = `git status --short` truthiness) treats an untracked (`??`) file as "another session is editing this." But this repo's backlog is globally uncommitted, so a freshly-scaffolded item is `??` from birth — making `claim` refuse every brand-new item: a guaranteed false stop, not a real concurrency signal. A racing agent dirtying a file mid-flip shows `M`, not `??`; an untracked-from-birth file cannot have been "dirtied mid-flip." Fix: narrow `isDirty` to staged/modified states (ignore `??`), or add a `--force` escape. Carved from #083 (file-lock forks parked); independent of the JIT-lock build.

## Progress (2026-06-13) — resolved (already delivered + regression-pinned)

On pickup the `isDirty` guard **no longer exists** — it was removed wholesale in commit `3eac18d` (the whole `git status --short` pre-claim check + its `node:child_process` import were deleted, going further than this item's narrower "ignore `??`" fix). `we:scripts/backlog.mjs` now documents the posture directly: *"No git/commit check here: concurrency is owned by the status transition itself … The working tree's commit state is irrelevant to ownership."* So `claim` already never refuses a brand-new (`??`) item — #510's intent is fully satisfied.

What was missing was a **regression pin** — nothing stopped the false-positive from being reintroduced. Added [we:claim-no-git-guard.test.mjs](../scripts/backlog/__tests__/claim-no-git-guard.test.mjs) (2 tests, green): asserts `we:backlog.mjs` imports no `child_process` and contains no `git status` / `isDirty` dirty-or-untracked guard. `check:standards` green.
