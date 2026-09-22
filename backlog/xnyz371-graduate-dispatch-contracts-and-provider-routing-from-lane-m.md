---
kind: story
size: 5
parent: "3443"
status: open
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/gen-dispatch-routing-table.mjs", "we:scripts/lib/__tests__/codex-model-routing.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-profile.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-trial.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs", "we:scripts/lib/__tests__/dispatch-supervision-tree.test.mjs", "we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs", "we:scripts/lib/__tests__/dispatch-thresholds.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/lib/codex-model-routing.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/dispatch-size-policy.json", "we:scripts/lib/dispatch-supervision-tree.mjs", "we:scripts/lib/dispatch-supervisor-contract.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/lib/dispatch-thresholds.mjs", "we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate dispatch contracts and provider routing from lane/mechanical-dispatcher to main

Ports 10 files (we:scripts/lib/dispatch-task-type.mjs, we:scripts/lib/dispatch-thresholds.mjs, we:scripts/lib/codex-model-routing.mjs, we:scripts/lib/dispatch-contracts.mjs, we:scripts/lib/dispatch-supervision-tree.mjs, we:scripts/lib/dispatch-supervisor-contract.mjs, we:scripts/lib/dispatch-size-policy.json, we:scripts/gen-dispatch-routing-table.mjs, we:scripts/lib/provider-routing.mjs, we:scripts/codex-direct-task.mjs) plus their tests. Head of the critical path (A3 → B4 → C3 → D1 → D2 → E3). we:scripts/lib/provider-routing.mjs and we:scripts/codex-direct-task.mjs were also changed on main: diff-merge, never copy. Main also changed these files, so each gets a diff-merge: we:scripts/lib/provider-routing.mjs, we:scripts/codex-direct-task.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
