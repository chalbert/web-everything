---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# parked-pr-conflict-watch grace path never routes a queued statute-tier conflict (PR #2505 stuck)

Live bug, PR chalbert/web-everything#2505: a queued/approved PR conflicting on an append-only statute file
(we:docs/agent/platform-decisions.md) sat past its 30-minute drain grace window with no action. The grace
branch's `if (isStatuteTier) continue;` wrongly assumed a statute-tier conflict was always already handed to a
human at detection — false for a queued PR, which the fresh path defers to the drain instead. Factored the
statute/append-only classification into one shared function so the fresh-detection and grace-expiry routing can
never drift, added the missing append-only-dispatch and idempotent human hand-off to the grace path, and made
`--dry-run` report the grace routing decision instead of silently skipping it.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` passes,
   including the new `#3383` grace-path append-only and dry-run-reporting cases that did not exist before this
   item landed.
