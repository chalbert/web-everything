---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/__tests__/dispatcher-fixture-harness.test.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Share one free-lane scan across callers, and stop the dispatcher test from scanning the real lane pool

The biggest single load on 2026-09-23 was we:scripts/lane-pool.mjs list --acquirable: each call runs git cherry across every lane (82 now, about 28 s standalone, over 20 minutes under load), and about 6 ran at once. Many came from test suites: we:scripts/conveyor/__tests__/dispatcher-fixture-harness.test.mjs drives we:scripts/readiness/dispatch-plan.mjs, whose CLI shells the REAL lane-pool list (by design, "no fixture"). Two changes: (1) a short shared cache for list --acquirable (a result file with a TTL, setting default 30 s, plus a lock so parallel callers wait for one scan instead of each running their own); (2) a free-lane override for dispatch-plan (flag or env, e.g. --free-lanes-json) that the fixture test uses, so a test run never scans the real pool. Prototype work under #3383: build on lane/mechanical-dispatcher and commit there (no PR, one tracker note per push); the card lives on main; it reaches main through graduation slice #3916 (heavy-admission) or #3917 (dispatch-plan), whose merge notes must union it. Operator ask 2026-09-23: queue many stories and let the AI progress, but limit how many heavy commands run at once. Observed 2026-09-23 on the laptop: load average about 60 on 12 cores with the admission cap at 2.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
