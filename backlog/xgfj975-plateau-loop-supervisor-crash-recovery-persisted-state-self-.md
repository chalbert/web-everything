---
kind: story
size: 8
parent: "2445"
status: open
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: supervisor — crash recovery, persisted state, self-update-then-reload

The residency layer the red-team flagged: crash recovery, persisted state across sleep/reboot, and the self-hosting boundary (coordinator drains its own PR, restarts, resumes) with #2077-style self-exclusion so it never parallel-edits itself. Parked behind evidence.
