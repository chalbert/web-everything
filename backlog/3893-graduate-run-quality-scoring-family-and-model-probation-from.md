---
bornAs: x87gqii
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/conveyor/__tests__/run-quality-record.test.mjs", "we:scripts/conveyor/__tests__/run-quality-route.test.mjs", "we:scripts/conveyor/__tests__/run-quality-rubric.test.mjs", "we:scripts/conveyor/__tests__/run-quality-scorer.test.mjs", "we:scripts/conveyor/__tests__/run-quality-sink.test.mjs", "we:scripts/conveyor/__tests__/run-quality-subject-class.test.mjs", "we:scripts/conveyor/run-quality-record.mjs", "we:scripts/conveyor/run-quality-route.mjs", "we:scripts/conveyor/run-quality-rubric.mjs", "we:scripts/conveyor/run-quality-scorer.mjs", "we:scripts/conveyor/run-quality-sink.mjs", "we:scripts/conveyor/run-quality-subject-class.mjs", "we:scripts/lib/__tests__/model-probation.test.mjs", "we:scripts/lib/model-probation.json", "we:scripts/lib/model-probation.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate run-quality scoring family and model-probation from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/conveyor/run-quality-record.mjs, we:scripts/conveyor/run-quality-route.mjs, we:scripts/conveyor/run-quality-rubric.mjs, we:scripts/conveyor/run-quality-scorer.mjs, we:scripts/conveyor/run-quality-sink.mjs, we:scripts/conveyor/run-quality-subject-class.mjs, we:scripts/lib/model-probation.mjs, we:scripts/lib/model-probation.json) plus their tests. Imported by the judge spawns and every dispatch wrapper. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/run-quality-record.test.mjs we:scripts/conveyor/__tests__/run-quality-route.test.mjs we:scripts/conveyor/__tests__/run-quality-rubric.test.mjs we:scripts/conveyor/__tests__/run-quality-scorer.test.mjs we:scripts/conveyor/__tests__/run-quality-sink.test.mjs we:scripts/conveyor/__tests__/run-quality-subject-class.test.mjs we:scripts/lib/__tests__/model-probation.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.
