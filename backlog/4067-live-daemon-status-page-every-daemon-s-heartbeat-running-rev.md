---
bornAs: xaawsd6
kind: story
size: 5
parent: "4075"
status: resolved
blockedBy: ["4065"]
scope: ["we:scripts/operations/daemon-status.mjs", "we:scripts/operations/daemon-status-io.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Live daemon status page: every daemon's heartbeat, running revision, last tick, owed work and open health episodes in one read

Operator ask 2026-09-24. One read-only declared operation that joins runner-activity (we:scripts/operations/runner-activity-io.mjs), the heartbeat revision and overlays (#4051), and the health daemon's open episodes, rendered on the plateau /wip Fleet panel (pending card xqjl5lf) and printable in the terminal. It reads the same probe results the health daemon writes, so the page and the alerts can never disagree.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs daemon-status --json` returns one row per known
   daemon (state, running revision, last tick, owed work) plus the open health episodes; a test pins the
   join.
2. **Live proof** — the /wip Fleet panel shows the same rows as the terminal read on the running fleet.
