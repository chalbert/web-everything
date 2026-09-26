---
bornAs: xvz55jf
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

Read-only declared operation `live-state` (follows daemon-status #4067 and heavy-queue for pattern + fidelity-test rules). One JSON snapshot that REUSES existing operations/exports, never re-deriving them: daemons, open health episodes, the test queue, lane pools (free/leased/dirty), the drain's last pass, GitHub App auth state, and machine load. Each section gets a status (green/yellow/red) with a one-line reason; thresholds documented in the file. Feeds the plateau-app /wip machine-health strip (blocked-by this card).

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs live-state --json` fails before this item lands (no such operation) and returns one JSON snapshot with an `overall` status plus `daemons`/`health`/`testQueue`/`lanes`/`drain`/`githubAuth`/`machineLoad` sections after.
