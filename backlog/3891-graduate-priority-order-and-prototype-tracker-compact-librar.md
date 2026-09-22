---
bornAs: x4paeb9
kind: story
size: 2
parent: "3443"
status: open
scope: ["we:scripts/__tests__/priority-order.test.mjs", "we:scripts/__tests__/prototype-tracker-render-real.test.mjs", "we:scripts/lib/__tests__/prototype-tracker-compact.test.mjs", "we:scripts/lib/priority-markers.mjs", "we:scripts/lib/priority-order.mjs", "we:scripts/lib/prototype-tracker-compact.mjs", "we:scripts/lib/prototype-tracker-render.mjs", "we:scripts/lib/tracker-page-hash.mjs", "we:scripts/__tests__/fixtures/tracker-compact-fixture.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate priority-order and prototype-tracker-compact libraries from lane/mechanical-dispatcher to main

Ports 5 files (we:scripts/lib/priority-markers.mjs, we:scripts/lib/priority-order.mjs, we:scripts/lib/tracker-page-hash.mjs, we:scripts/lib/prototype-tracker-compact.mjs, we:scripts/lib/prototype-tracker-render.mjs) plus their tests. Needed by #3865 (land-advance-items-io imports prototype-tracker-compact), priority-sync and tracker-refresh. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
