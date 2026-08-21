---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Can a juror silently review the wrong tree?

Two jurors on 2026-08-21 reported reading a checkout 167 commits behind while both the driver lane and the juror lane sat at origin/main with 0 behind — most likely the stale primary at the shared workspace path. Separately two other jurors reported line citations off by a similar constant on one large file. If a juror can resolve a different tree than the one under review, every file-anchored finding is suspect and the failure is silent in both directions: a real defect missed, or a phantom reported against code that moved. Establish what a juror actually resolves and pin it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
