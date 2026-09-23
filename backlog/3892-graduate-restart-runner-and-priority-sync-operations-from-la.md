---
bornAs: x0mu20g
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3891"]
scope: ["we:scripts/operations/__tests__/priority-sync-real.test.mjs", "we:scripts/operations/__tests__/priority-sync.test.mjs", "we:scripts/operations/__tests__/restart-runner-io-real.test.mjs", "we:scripts/operations/__tests__/restart-runner.test.mjs", "we:scripts/operations/priority-sync-io.mjs", "we:scripts/operations/priority-sync.mjs", "we:scripts/operations/restart-runner-io.mjs", "we:scripts/operations/restart-runner.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate restart-runner and priority-sync operations from lane/mechanical-dispatcher to main

Ports 4 files (we:scripts/operations/restart-runner.mjs, we:scripts/operations/restart-runner-io.mjs, we:scripts/operations/priority-sync.mjs, we:scripts/operations/priority-sync-io.mjs) plus their tests. Adds its own registrations to we:scripts/operations/run.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
