---
kind: story
size: 5
parent: "3931"
status: active
scope: ["we:scripts/operations/live-state.mjs", "we:scripts/operations/live-state-io.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-26"
dateStarted: "2026-09-26"
tags: []
---

# live-state operation: one read-only snapshot of daemons, health episodes, test queue, lanes, drain and GitHub auth for /wip

Read-only declared operation `live-state` (follows daemon-status #4067 and heavy-queue for pattern + fidelity-test rules). One JSON snapshot that REUSES existing operations/exports, never re-deriving them: daemons (daemon-status), open health episodes (health watch episode store / operator-queue --with-health data), test queue + projected wait (heavy-queue), lanes free/leased/dirty (lane-pool status), drain last pass time+result (plateau-app:.drain-daemon/history.jsonl), GitHub App auth state (the GitHub App token status file kept under the operator's Claude config directory, outside any repo), machine load (loadavg + cores). Each section gets a status (green/yellow/red) with a one-line reason; thresholds documented in the file. Feeds the plateau-app /wip machine-health strip (blocked-by this card).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
