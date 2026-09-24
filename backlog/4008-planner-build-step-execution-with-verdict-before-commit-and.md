---
bornAs: xvcz3nk
kind: story
size: 8
parent: "3383"
status: open
blockedBy: ["4004", "4001", "3994"]
dateOpened: "2026-09-23"
tags: []
---

# Planner build: step execution with verdict-before-commit and the request and resume loop

Child 6 of #3922. One launch function for every step; executors run with --dir in the step lane; --binary diff capture; git apply --3way onto a temporary index on the item lane; commit only after accept; parallel steps only with non-overlapping file lists; the wrapper runs requests and resumes the step; before/after check of every constellation checkout around each Gemini step. Acceptance: one real headless Sonnet step end to end in a pool lane under its settings file.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
