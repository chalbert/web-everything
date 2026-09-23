---
kind: story
size: 5
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Planner build: separate planner and checker roles with their own trust records

Child 2 of #3922. Split the one supervise role into plan and supervise, each with its own ladder and trust record. Planner model by card size (Sonnet below 8, Opus at 8+ or high-risk or statute-tier). Checker Sonnet by default; a PR-panel-found miss moves that {model, taskType, risk} cell up to Opus; clean reviews since are recorded so the operator can move it back. Checker newTasks refused. Plan and verdict calls through SUPERVISOR_INVOCATIONS, verifying its two UNVERIFIED flags.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
