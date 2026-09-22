---
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["xb9av7z", "x87gqii"]
scope: ["we:scripts/operations/__tests__/completion-cli.test.mjs", "we:scripts/operations/__tests__/completion-record.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:scripts/operations/__tests__/delivery-agent-marker.test.mjs", "we:scripts/operations/completion-cli.mjs", "we:scripts/operations/completion-record.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/delivery-agent-marker.mjs", "we:scripts/operations/delivery-report-store.mjs", "we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate deliver-item wrapper changes, deliver-item-run and delivery-agent-marker from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/operations/deliver-item-wrapper.mjs, we:scripts/operations/deliver-item-run.mjs, we:scripts/operations/delivery-agent-marker.mjs, we:scripts/operations/delivery-report-store.mjs, we:scripts/operations/completion-record.mjs, we:scripts/operations/completion-cli.mjs, we:skills-src/conveyor/delivery-agent-brief.md, we:skills-src/conveyor/delivery-agent-brief-v2.md) plus their tests. On the critical path. we:scripts/operations/deliver-item-wrapper.mjs is a 1.6k-line diff that main also changed. Main also changed these files, so each gets a diff-merge: we:scripts/operations/deliver-item-wrapper.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
