---
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3856", "xnyz371"]
scope: ["we:scripts/operations/__tests__/wip-agents-io.test.mjs", "we:scripts/operations/__tests__/wip-agents.test.mjs", "we:scripts/operations/__tests__/wip-report-compact.test.mjs", "we:scripts/operations/__tests__/wip-report-io-real.test.mjs", "we:scripts/operations/__tests__/wip-report-io.test.mjs", "we:scripts/operations/__tests__/wip-report-queue.test.mjs", "we:scripts/operations/__tests__/wip-report.test.mjs", "we:scripts/operations/wip-agents-cli.mjs", "we:scripts/operations/wip-agents-io.mjs", "we:scripts/operations/wip-agents.mjs", "we:scripts/operations/wip-report-cli.mjs", "we:scripts/operations/wip-report-io.mjs", "we:scripts/operations/wip-report-queue.mjs", "we:scripts/operations/wip-report.mjs", "we:scripts/operations/__fixtures__/wip-agents/", "we:scripts/operations/__fixtures__/wip-report/", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate wip-agents and wip-report operations from lane/mechanical-dispatcher to main

Ports 7 files (we:scripts/operations/wip-agents.mjs, we:scripts/operations/wip-agents-io.mjs, we:scripts/operations/wip-agents-cli.mjs, we:scripts/operations/wip-report.mjs, we:scripts/operations/wip-report-io.mjs, we:scripts/operations/wip-report-queue.mjs, we:scripts/operations/wip-report-cli.mjs) plus their tests. Adds its own registrations to we:scripts/operations/run.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
