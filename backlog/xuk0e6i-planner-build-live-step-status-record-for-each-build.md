---
kind: story
size: 3
parent: "3383"
status: open
blockedBy: ["xacbhmg"]
dateOpened: "2026-09-23"
tags: []
---

# Planner build: live step status record for each build

Child 7b of #3922. The plan runner writes each step state (planned, running, checking, accepted, rework) to a durable record per card, readable by dashboards, so a build is never opaque. In shadow mode the plan shows beside the single worker.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
