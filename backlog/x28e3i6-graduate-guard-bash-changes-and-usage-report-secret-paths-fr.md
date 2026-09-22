---
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/__tests__/guard-bash.test.mjs", "we:scripts/guard-bash.mjs", "we:scripts/lib/usage-report-secret-paths.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate guard-bash changes and usage-report-secret-paths from lane/mechanical-dispatcher to main

Ports 2 files (we:scripts/guard-bash.mjs, we:scripts/lib/usage-report-secret-paths.mjs) plus their tests. main changed we:scripts/guard-bash.mjs 14 times since the merge base: diff-merge, keeping every guard main added. Main also changed these files, so each gets a diff-merge: we:scripts/guard-bash.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
