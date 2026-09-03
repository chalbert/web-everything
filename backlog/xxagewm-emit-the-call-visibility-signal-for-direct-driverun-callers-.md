---
kind: task
parent: "3427"
status: open
blockedBy: ["3451"]
scope: ["we:scripts/backlog.mjs", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-03"
tags: []
---

# Emit the call-visibility signal for direct driveRun callers (backlog claim, review-loop-cli)

we:scripts/backlog.mjs's claim command and we:scripts/operations/review-loop-cli.mjs both call the operations engine's driveRun directly, bypassing we:scripts/operations/cli-adapter.mjs and we:scripts/operations/http-adapter.mjs — the two derived callers #3451 instruments with the new call-log signal. So the busiest declared-operation call site (claim) and the automated review-loop driver still leave zero call-visibility trace. Wire callLog: createFileCallLogStore() (we:scripts/operations/call-log-store.mjs, landed by #3451) into both entry points, mirroring how we:scripts/operations/run.mjs wires it for the CLI adapter.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
