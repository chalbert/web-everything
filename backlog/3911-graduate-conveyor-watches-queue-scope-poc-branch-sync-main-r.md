---
bornAs: xzha7g1
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/conveyor/__tests__/infra-blocked.test.mjs", "we:scripts/conveyor/__tests__/main-ref-sync.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs", "we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs", "we:scripts/conveyor/__tests__/queue-scope-wiring.test.mjs", "we:scripts/conveyor/__tests__/queue-scope.test.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/infra-blocked.mjs", "we:scripts/conveyor/main-ref-sync.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/poc-branch-sync.mjs", "we:scripts/conveyor/queue-scope.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/lib/swept-repos.json"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate conveyor watches: queue-scope, poc-branch-sync, main-ref-sync and watch diffs from lane/mechanical-dispatcher to main

Ports 11 files (we:scripts/conveyor/queue-scope.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/verify-dispatch.mjs, we:scripts/conveyor/infra-blocked.mjs, we:scripts/conveyor/poc-branch-sync.mjs, we:scripts/conveyor/main-ref-sync.mjs, we:scripts/lib/poc-branches.mjs, we:scripts/lib/poc-branches.json, we:scripts/lib/swept-repos.json) plus their tests. queue-scope is new and imported by the watches, reconcile-pass and the runner. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
