---
bornAs: x67773u
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3903"]
scope: ["we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs", "we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs", "we:scripts/operations/ci-heal-dispatch-wrapper.mjs", "we:scripts/operations/ci-heal-run.mjs", "we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/fix-run.mjs", "we:skills-src/conveyor/ci-heal-agent-brief-v2.md", "we:skills-src/conveyor/fix-agent-brief-v2.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate fix and ci-heal dispatch wrappers, runs and v2 briefs from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/operations/fix-dispatch-wrapper.mjs, we:scripts/operations/fix-run.mjs, we:scripts/operations/ci-heal-dispatch-wrapper.mjs, we:scripts/operations/ci-heal-run.mjs, we:skills-src/conveyor/fix-agent-brief-v2.md, we:skills-src/conveyor/ci-heal-agent-brief-v2.md, we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md) plus their tests.  Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
