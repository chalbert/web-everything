---
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["x4rkpuk"]
scope: ["we:scripts/operations/__tests__/prepare-decision-wrapper.test.mjs", "we:scripts/operations/__tests__/prepare-scope-wrapper.test.mjs", "we:scripts/operations/prepare-decision-run.mjs", "we:scripts/operations/prepare-decision-wrapper.mjs", "we:scripts/operations/prepare-scope-run.mjs", "we:scripts/operations/prepare-scope-wrapper.mjs", "we:skills-src/conveyor/prepare-decision-agent-brief-v2.md", "we:skills-src/conveyor/prepare-decision-agent-brief.md", "we:skills-src/conveyor/prepare-scope-agent-brief-v2.md", "we:skills-src/conveyor/prepare-scope-agent-brief.md"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate prepare-scope and prepare-decision dispatch wrappers, runs and v2 briefs from lane/mechanical-dispatcher to main

Ports 9 files (we:scripts/operations/prepare-scope-wrapper.mjs, we:scripts/operations/prepare-scope-run.mjs, we:scripts/operations/prepare-decision-wrapper.mjs, we:scripts/operations/prepare-decision-run.mjs, we:skills-src/conveyor/prepare-scope-agent-brief-v2.md, we:skills-src/conveyor/prepare-decision-agent-brief-v2.md, we:skills-src/conveyor/prepare-scope-agent-brief.md, we:skills-src/conveyor/prepare-decision-agent-brief.md, we:skills-src/conveyor/investigation-agent-brief.md) plus their tests.  Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
