---
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["xvrxwha", "xm24wzq", "xnyz371", "x28e3i6"]
scope: ["we:scripts/lib/__tests__/spawn-to-completion.test.mjs", "we:scripts/lib/spawn-to-completion.mjs", "we:scripts/operations/__tests__/codex-delivery-provider.test.mjs", "we:scripts/operations/__tests__/fix-report-cli.test.mjs", "we:scripts/operations/__tests__/fix-report-record.test.mjs", "we:scripts/operations/__tests__/fix-report-store.test.mjs", "we:scripts/operations/__tests__/minimal-context-provider.test.mjs", "we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/operations/detached-dispatch.mjs", "we:scripts/operations/fix-report-cli.mjs", "we:scripts/operations/fix-report-record.mjs", "we:scripts/operations/fix-report-store.mjs", "we:scripts/operations/minimal-context-provider.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate delivery foundation: spawn-to-completion, detached-dispatch, minimal-context-provider, codex-delivery-provider, fix-report store from lane/mechanical-dispatcher to main

Ports 7 files (we:scripts/lib/spawn-to-completion.mjs, we:scripts/operations/detached-dispatch.mjs, we:scripts/operations/minimal-context-provider.mjs, we:scripts/operations/codex-delivery-provider.mjs, we:scripts/operations/fix-report-record.mjs, we:scripts/operations/fix-report-store.mjs, we:scripts/operations/fix-report-cli.mjs) plus their tests. On the critical path. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
