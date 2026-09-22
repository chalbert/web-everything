---
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["xao8xbi", "x0mu20g", "x4paeb9"]
scope: ["we:scripts/__tests__/fixtures/prototype-tracker-full.golden.html", "we:scripts/lib/prototype-tracker-compact-io.mjs", "we:scripts/operations/__tests__/tracker-refresh-real.test.mjs", "we:scripts/operations/__tests__/tracker-refresh.test.mjs", "we:scripts/operations/__tests__/turn-digest.test.mjs", "we:scripts/operations/tracker-refresh-io.mjs", "we:scripts/operations/tracker-refresh-state.mjs", "we:scripts/operations/tracker-refresh.mjs", "we:scripts/operations/turn-digest-io.mjs", "we:scripts/operations/turn-digest.mjs", "we:scripts/prototype-tracker.mjs", "we:skills-src/prototype-tracker/SKILL.md", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate tracker-refresh, turn-digest and prototype-tracker-compact-io from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/lib/prototype-tracker-compact-io.mjs, we:scripts/operations/tracker-refresh.mjs, we:scripts/operations/tracker-refresh-io.mjs, we:scripts/operations/tracker-refresh-state.mjs, we:scripts/operations/turn-digest.mjs, we:scripts/operations/turn-digest-io.mjs, we:scripts/prototype-tracker.mjs, we:skills-src/prototype-tracker/SKILL.md) plus their tests. Adds its own registrations to we:scripts/operations/run.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
