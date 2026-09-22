---
kind: story
size: 5
parent: "3443"
status: open
scope: ["we:scripts/operations/__tests__/command-redact.test.mjs", "we:scripts/operations/__tests__/telemetry-wiring.test.mjs", "we:scripts/operations/__tests__/telemetry.test.mjs", "we:scripts/operations/command-redact.mjs", "we:scripts/operations/telemetry-cli.mjs", "we:scripts/operations/telemetry-store.mjs", "we:scripts/operations/telemetry.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate telemetry core (telemetry, telemetry-store, telemetry-cli, command-redact) from lane/mechanical-dispatcher to main

Ports 4 files (we:scripts/operations/command-redact.mjs, we:scripts/operations/telemetry.mjs, we:scripts/operations/telemetry-store.mjs, we:scripts/operations/telemetry-cli.mjs) plus their tests. Leaf layer. telemetry-store is imported by gh-throttle, every dispatch wrapper, minimal-context-provider and the runner. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
