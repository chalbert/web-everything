---
bornAs: xao8xbi
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3856", "3897", "3906"]
scope: ["we:scripts/operations/__tests__/wip-agents-io.test.mjs", "we:scripts/operations/__tests__/wip-report-compact.test.mjs", "we:scripts/operations/__tests__/wip-report-io-real.test.mjs", "we:scripts/operations/__tests__/wip-report-io.test.mjs", "we:scripts/operations/__tests__/wip-report-queue.test.mjs", "we:scripts/operations/__tests__/wip-report.test.mjs", "we:scripts/operations/wip-agents-cli.mjs", "we:scripts/operations/wip-agents-io.mjs", "we:scripts/operations/wip-agents.mjs", "we:scripts/operations/wip-report-cli.mjs", "we:scripts/operations/wip-report-io.mjs", "we:scripts/operations/wip-report-queue.mjs", "we:scripts/operations/wip-report.mjs", "we:scripts/operations/__fixtures__/wip-agents/", "we:scripts/operations/__fixtures__/wip-report/", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:scripts/operations/__fixtures__/wip-agents/finished-not-reaped.json", "we:scripts/operations/__fixtures__/wip-agents/live-finished-dead.json", "we:scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate wip-agents and wip-report operations from lane/mechanical-dispatcher to main

Ports 7 files (we:scripts/operations/wip-agents.mjs, we:scripts/operations/wip-agents-io.mjs, we:scripts/operations/wip-agents-cli.mjs, we:scripts/operations/wip-report.mjs, we:scripts/operations/wip-report-io.mjs, we:scripts/operations/wip-report-queue.mjs, we:scripts/operations/wip-report-cli.mjs) plus their tests. Adds its own registrations to we:scripts/operations/run.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/wip-agents-io.test.mjs we:scripts/operations/__tests__/wip-agents.test.mjs we:scripts/operations/__tests__/wip-report-compact.test.mjs we:scripts/operations/__tests__/wip-report-io-real.test.mjs we:scripts/operations/__tests__/wip-report-io.test.mjs we:scripts/operations/__tests__/wip-report-queue.test.mjs we:scripts/operations/__tests__/wip-report.test.mjs we:scripts/operations/__tests__/http-adapter.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Graduation import check

- 2026-09-25: graduation-import-check added blockedBy #3906 — `we:scripts/operations/wip-agents-io.mjs` imports a module #3906 owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-report.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-report-queue.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-report-io.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-report/raw-2026-09-20.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-report-compact.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check made this a blocker of #3862 — its moved-in `we:scripts/operations/__tests__/wip-agents.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/wip-agents.test.mjs` to #3862 — it imports a module #3862 owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-agents/live-finished-dead.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-agents-io.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added we:scripts/operations/__fixtures__/wip-agents/finished-not-reaped.json to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/wip-agents-io.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added blockedBy #3906 — the moved-in `we:scripts/operations/__tests__/wip-agents-io.test.mjs` also imports a module #3906 owns.
