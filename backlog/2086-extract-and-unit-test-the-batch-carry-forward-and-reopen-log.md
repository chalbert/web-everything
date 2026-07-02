---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: []
---

# Extract and unit-test the batch carry-forward and reopen logic from the parallel orchestrator

The carry-forward decision logic (when an item is carried and reopened instead of landed) lives inline in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js — hard to audit, and a bug cascades across 12-plus items per batch as the 2026-07-01 closeout showed. Extract it into a named, unit-tested function with synthetic batch scenarios so the highest-leverage orchestrator failure mode becomes reviewable.
