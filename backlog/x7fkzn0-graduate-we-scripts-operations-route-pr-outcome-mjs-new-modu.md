---
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/operations/route-pr-outcome.mjs", "we:scripts/operations/route-pr-outcome-io.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/wake.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate we:scripts/operations/route-pr-outcome.mjs (new module) from lane/mechanical-dispatcher to main

Part 1 of 3 of the core reconcile-pass payload (#3437s name-based-bind fix is confirmed landed on main as of 2026-09-04, unblocking this whole group per #3443s own Done-when #2). Two wholly new modules on origin/lane/mechanical-dispatcher, missing from main entirely: we:scripts/operations/route-pr-outcome.mjs and we:scripts/operations/route-pr-outcome-io.mjs, with their tests (we:scripts/operations/__tests__/route-pr-outcome.test.mjs, we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs). Also carries session-identity plumbing changes in we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/explore-io.mjs, we:scripts/operations/run.mjs, we:scripts/operations/wake.mjs that route-pr-outcome depends on, plus their test updates. CAUTION -- overlap risk: we:scripts/operations/dispatch-lane-io.mjs is ALSO touched by the sibling dispatch-lane hardening slice (WE_DISPATCH_KIND wiring); whoever builds either slice should diff the other slices hunks first to avoid duplicate/conflicting edits to the same file. Land this before the we:skills-src/conveyor/supervisor.mjs slice and before the we:skills-src/conveyor/runner.mjs reconcile-pass-wiring slice -- both are expected to depend on route-pr-outcome existing on main, though the exact call graph should be confirmed by whoever builds this, not assumed from this cards prose.

## Done when

1. **Executable** — `we:scripts/operations/route-pr-outcome.mjs` and `we:scripts/operations/route-pr-outcome-io.mjs` exist on `main` with their tests passing, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/explore-io.mjs we:scripts/operations/run.mjs we:scripts/operations/wake.mjs` reports no diff not already accounted for by the sibling dispatch-lane-hardening slice.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.
