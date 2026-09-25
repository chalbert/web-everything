---
bornAs: xte9opm
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3487"]
scope: ["we:scripts/conveyor/__tests__/validate-and-promote.test.mjs", "we:scripts/conveyor/validate-and-promote.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate validate-and-promote from lane/mechanical-dispatcher to main

Ports 1 files (we:scripts/conveyor/validate-and-promote.mjs) plus their tests. Nothing on the branch imports it yet (its commit calls it the trigger that arms the watchdog); ordered after the runtime core. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/validate-and-promote.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Graduation import check

- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/conveyor/validate-and-promote.mjs`, which this card ports.
