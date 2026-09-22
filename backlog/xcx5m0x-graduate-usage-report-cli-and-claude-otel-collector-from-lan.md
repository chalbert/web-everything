---
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["xm24wzq", "x28e3i6"]
scope: ["we:scripts/operations/__tests__/claude-otel-collector.test.mjs", "we:scripts/operations/claude-otel-collector.mjs", "we:scripts/usage-report/.env.example", "we:scripts/usage-report/README.md", "we:scripts/usage-report/__tests__/usage-report.test.mjs", "we:scripts/usage-report/usage-report.mjs", "we:scripts/usage-report/__tests__/usage-ledger.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate usage-report CLI and claude-otel-collector from lane/mechanical-dispatcher to main

Ports 4 files (we:scripts/usage-report/usage-report.mjs, we:scripts/usage-report/README.md, we:scripts/usage-report/.env.example, we:scripts/operations/claude-otel-collector.mjs) plus their tests. Standalone CLI, isolated from dispatch; no ordering pressure. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
