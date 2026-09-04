---
bornAs: x8tghnd
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3482"]
scope: ["we:skills-src/conveyor/supervisor.mjs", "we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate we:skills-src/conveyor/supervisor.mjs (new standalone daemon) from lane/mechanical-dispatcher to main

Part 2 of 3 of the core reconcile-pass payload (see the sibling we:scripts/operations/route-pr-outcome.mjs slice for part 1 -- land that first, this depends on it existing on main). A wholly new module, missing from main entirely: we:skills-src/conveyor/supervisor.mjs (a standalone daemon process, ~555 lines), its test (we:skills-src/conveyor/__tests__/supervisor.test.mjs, ~590 lines), and a launchd example (we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example). This is the biggest single new file on the branch -- whoever builds this should read it fresh rather than trust this cards summary, and confirm what we:skills-src/conveyor/supervisor.mjs actually depends on before assuming the route-pr-outcome dependency above is real (it is inferred from the branchs commit grouping, not verified by reading the code). Land before the we:skills-src/conveyor/runner.mjs reconcile-pass-wiring slice (part 3), which is expected to spawn/supervise via this daemon.

## Done when

1. **Executable** — `we:skills-src/conveyor/supervisor.mjs` exists on `main` with `we:skills-src/conveyor/__tests__/supervisor.test.mjs` passing, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:skills-src/conveyor/supervisor.mjs we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example` reports no diff.
2. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before the `blockedBy` slice above.
