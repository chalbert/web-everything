---
bornAs: x67773u
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3903", "3905", "x0n0eiz", "xvlu8t1"]
scope: ["we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs", "we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs", "we:skills-src/conveyor/ci-heal-agent-brief-v2.md", "we:skills-src/conveyor/fix-agent-brief-v2.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-ci-heal-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-fix-wiring.test.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate fix and ci-heal dispatch wrappers, runs and v2 briefs from lane/mechanical-dispatcher to main

Ports 8 files (we:scripts/operations/fix-dispatch-wrapper.mjs, we:scripts/operations/fix-run.mjs, we:scripts/operations/ci-heal-dispatch-wrapper.mjs, we:scripts/operations/ci-heal-run.mjs, we:skills-src/conveyor/fix-agent-brief-v2.md, we:skills-src/conveyor/ci-heal-agent-brief-v2.md, we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md) plus their tests.  Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 6a2c8c1ab of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Graduation import check

- 2026-09-25: graduation-import-check added blockedBy #xvlu8t1 — the moved-in `we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs` also imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check added blockedBy #xvlu8t1 — the moved-in `we:scripts/operations/__tests__/dispatch-lane-fix-wiring.test.mjs` also imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check added blockedBy #xvlu8t1 — the moved-in `we:scripts/operations/__tests__/dispatch-lane-ci-heal-wiring.test.mjs` also imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check added blockedBy #xvlu8t1 — the moved-in `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` also imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check added blockedBy #xvlu8t1 — the moved-in `we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs` also imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/fix-dispatch-wrapper.mjs` to #3906 — #3906's `we:scripts/operations/fix-run.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` to #3906 — #3906's `we:scripts/operations/ci-heal-run.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/fix-run.mjs` to #3906 — #3906's `we:scripts/operations/dispatch-providers/fix.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/ci-heal-run.mjs` to #3906 — #3906's `we:scripts/operations/dispatch-providers/ci-heal.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs`, which this card ports.
- 2026-09-24: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane-fix-wiring.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-24: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane-ci-heal-wiring.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-24: graduation-import-check added blockedBy #3905 — the moved-in `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` also imports a module #3905 owns.
- 2026-09-24: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` here from #3906 — it imports a module this card owns.
