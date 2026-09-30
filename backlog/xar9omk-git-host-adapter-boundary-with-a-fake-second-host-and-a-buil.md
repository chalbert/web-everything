---
kind: story
size: 5
status: open
scope: ["we:docs/agent/review-state-ledger-target.md"]
dateOpened: "2026-09-30"
tags: []
---

# Git host adapter boundary with a fake second host and a built-in facts-from-git capability

Follows ruling #4598. Introduce a host-adapter interface (GitHub first) with a fake second host used in tests, and a shared facts-from-git capability (merges, commits, co-author trailers, conflicts via git merge-tree) every adapter inherits. Today already-done and pr-limit move to git (PR #3103). GitLab/Bitbucket adapters only on real customer need. Filed for later.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
