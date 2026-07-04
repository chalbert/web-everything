---
kind: story
size: 8
parent: "2268"
status: open
blockedBy: ["2274", "2270", "2271"]
dateOpened: "2026-07-04"
tags: []
---

# Tier-B session-replay harness for judgment skills in an ephemeral worktree

Run a judgment-driven skill (batch, drain, finish, next, review-program) for real inside an ephemeral, revertible git worktree seeded from a corpus fixture, assert the invariant catalogue against the resulting tree, then discard the worktree. Session-run, not CI. Split candidate (size 8): one skill end-to-end first, then generalize the replay driver across skills.
