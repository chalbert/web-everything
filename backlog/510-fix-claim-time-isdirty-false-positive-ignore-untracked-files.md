---
type: issue
workItem: task
status: open
dateOpened: "2026-06-14"
tags: []
---

# Fix claim-time isDirty false-positive — ignore untracked (??) files

The pre-claim guard in `scripts/backlog.mjs` (`isDirty` = `git status --short` truthiness) treats an untracked (`??`) file as "another session is editing this." But this repo's backlog is globally uncommitted, so a freshly-scaffolded item is `??` from birth — making `claim` refuse every brand-new item: a guaranteed false stop, not a real concurrency signal. A racing agent dirtying a file mid-flip shows `M`, not `??`; an untracked-from-birth file cannot have been "dirtied mid-flip." Fix: narrow `isDirty` to staged/modified states (ignore `??`), or add a `--force` escape. Carved from #083 (file-lock forks parked); independent of the JIT-lock build.
