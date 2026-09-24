---
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Planner build: plan schema and routing inputs (task type by cause then files, doc allowlist, sizeSource plan)

Child 1 of #3922. Remove the planner-declared taskType from PLAN_OUTPUT_SCHEMA; derive a step type from why it exists (planned, apply clash to conflict-resolution, repair of accepted work to bugfix) then its files; make the doc test an allowlist of reader-facing doc places; make decideDispatchRoute honour sizeSource plan; pass risk through raiseRisk; record new versus modified files and lines on each trial.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
