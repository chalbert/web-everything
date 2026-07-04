---
kind: decision
parent: "2268"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Execution substrate for skill/memory replay: dry-run flags vs revertible worktree

How does the suite run a mutating skill/script without leaving state behind? Fork A: retrofit a faithful --dry-run onto every script/skill (large surface, and git-mutating skills would test a stubbed path). Fork B (bold default): replay the real skill inside an ephemeral git worktree, assert on the resulting tree, then git worktree remove — reuses the existing lane-clone/worktree machinery, no per-skill retrofit, faithful. Likely: worktree-replay as the primary substrate, cheap --dry-run only on pure Tier-A scripts.
