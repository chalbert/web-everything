---
kind: task
parent: "4075"
status: open
dateOpened: "2026-09-29"
tags: []
---

# Add unit test coverage for we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs

we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs has no unit test at all, unlike its sibling we:scripts/conveyor/health-smells/dispatch-permission-stall.mjs (which has a .test.mjs covering its pure evaluate()). Add a we:scripts/conveyor/health-smells/__tests__/dispatch-trust-refused.test.mjs mirroring the sibling's shape: evaluate() over synthetic daemon-memory fixtures, breach/no-breach on the trustRefusalTimes window, and the openAfter/closeAfter thresholds. Noticed while building #4318 (a check:standards guard), unrelated to that item's own scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
