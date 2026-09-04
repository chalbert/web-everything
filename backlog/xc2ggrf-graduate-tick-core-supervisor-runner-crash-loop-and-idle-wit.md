---
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["x8tghnd", "xmlh0rb"]
scope: ["we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/supervisor.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate tick-core + supervisor/runner crash-loop and idle-with-queue alerting hardening from lane/mechanical-dispatcher to main

Bug fixes and alerting layered ON TOP of the new we:skills-src/conveyor/supervisor.mjs and we:skills-src/conveyor/runner.mjs reconcile-pass wiring (the two sibling slices in this group) -- land after both, since several branch commits interleave edits to we:scripts/conveyor/tick-core.mjs together with we:skills-src/conveyor/runner.mjs and we:skills-src/conveyor/supervisor.mjs and do not cleanly separate. Covers: the durable build-guard floor that never expired and permanently inflated the building count (#3403), heartbeating the singleton lease mid-pass rather than only after the tick (#3404), stopping dispatchPass own guard bookkeeping from suppressing its own dispatch (#3416), backing off a repeated idle-stop respawn distinct from a stand-down (#3406), and supervisor out-of-band alerting for crash-loop plus idle-with-queue (#3398). Tests: we:scripts/conveyor/__tests__/tick-core.test.mjs (new), we:skills-src/conveyor/__tests__/runner.test.mjs, we:skills-src/conveyor/__tests__/supervisor.test.mjs.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/conveyor/tick-core.mjs we:skills-src/conveyor/runner.mjs we:skills-src/conveyor/supervisor.mjs` reports no diff not already accounted for by the two sibling slices above, and `we:scripts/conveyor/__tests__/tick-core.test.mjs` plus the runner/supervisor test suites pass on `main`.
2. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before both `blockedBy` slices above.
