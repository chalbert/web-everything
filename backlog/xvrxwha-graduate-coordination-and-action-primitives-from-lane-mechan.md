---
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/operations/__tests__/action-cli.test.mjs", "we:scripts/operations/__tests__/action-dispatch-paths.test.mjs", "we:scripts/operations/__tests__/action-ground-truth.test.mjs", "we:scripts/operations/__tests__/coordination-root.test.mjs", "we:scripts/operations/__tests__/session-role.test.mjs", "we:scripts/operations/__tests__/tick-mutex.test.mjs", "we:scripts/operations/__tests__/tick-throttle.test.mjs", "we:scripts/operations/action-cli.mjs", "we:scripts/operations/action-dispatch.mjs", "we:scripts/operations/action-ground-truth.mjs", "we:scripts/operations/action-record.mjs", "we:scripts/operations/action-store.mjs", "we:scripts/operations/coordination-lock.mjs", "we:scripts/operations/coordination-root.mjs", "we:scripts/operations/session-role.mjs", "we:scripts/operations/tick-mutex.mjs", "we:scripts/operations/tick-throttle.mjs", "we:scripts/operations/__tests__/action-records.test.mjs", "we:scripts/operations/__tests__/coordination-cross-clone.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate coordination and action primitives from lane/mechanical-dispatcher to main

Ports 10 files (we:scripts/operations/coordination-root.mjs, we:scripts/operations/coordination-lock.mjs, we:scripts/operations/action-record.mjs, we:scripts/operations/action-store.mjs, we:scripts/operations/action-ground-truth.mjs, we:scripts/operations/action-dispatch.mjs, we:scripts/operations/action-cli.mjs, we:scripts/operations/tick-mutex.mjs, we:scripts/operations/tick-throttle.mjs, we:scripts/operations/session-role.mjs) plus their tests. Leaf layer: imports nothing else that is branch-only. Imported by the dispatch path, the review loop, tick-once and the runner. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
