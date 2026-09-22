---
bornAs: xvknnyb
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3906", "3904", "3907"]
scope: ["we:scripts/conveyor/__tests__/advisory-round-count.test.mjs", "we:scripts/conveyor/__tests__/autofix-review-findings.test.mjs", "we:scripts/conveyor/__tests__/fix-autofix-gate.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs", "we:scripts/conveyor/advisory-round-count.mjs", "we:scripts/conveyor/autofix-review-findings.mjs", "we:scripts/conveyor/fix-autofix-gate.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/operations/__tests__/review-dispatch-wrapper.test.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/operations/review-dispatch-wrapper.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-routing.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-dispatch-integration.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate review loop: review-dispatch changes, wrapper, autofix and reconcile-fix-dispatch from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/operations/review-dispatch.mjs, we:scripts/operations/review-dispatch-wrapper.mjs, we:scripts/conveyor/autofix-review-findings.mjs, we:scripts/conveyor/fix-autofix-gate.mjs, we:scripts/conveyor/reconcile-fix-dispatch.mjs, we:scripts/conveyor/reconcile-core.mjs, we:scripts/conveyor/reconcile-pass.mjs, we:scripts/conveyor/advisory-round-count.mjs) plus their tests. On the critical path. Main also changed these files, so each gets a diff-merge: we:scripts/operations/review-dispatch.mjs, we:scripts/conveyor/reconcile-fix-dispatch.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
