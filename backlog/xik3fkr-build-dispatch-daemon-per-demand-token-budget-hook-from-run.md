---
kind: story
size: 3
parent: "3984"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/build-dispatch-policy.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# build-dispatch daemon: per-demand token budget hook from run rating

Once run rating (PR #2811, #4075) lands, give the build-dispatch daemon a per-demand token budget: before dispatch, read the item's size + task type and the run-rating efficiency history to set a budget; hold or downgrade dispatch when the budget for the day is spent; record budget vs actual on the run record. Keeps the daemon from re-creating the orchestration cost it exists to cut.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs` passes a new budget suite: a candidate whose projected tokens exceed the remaining daily budget is held with rule `token-budget`, and the run record carries budget vs actual.
