---
bornAs: xzha7g1
kind: story
size: 3
parent: "3443"
status: resolved
scope: ["we:scripts/conveyor/__tests__/infra-blocked.test.mjs", "we:scripts/conveyor/__tests__/main-ref-sync.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs", "we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs", "we:scripts/conveyor/__tests__/queue-scope-wiring.test.mjs", "we:scripts/conveyor/__tests__/queue-scope.test.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/infra-blocked.mjs", "we:scripts/conveyor/main-ref-sync.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/poc-branch-sync.mjs", "we:scripts/conveyor/queue-scope.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/lib/swept-repos.json"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Graduate conveyor watches: queue-scope, poc-branch-sync, main-ref-sync and watch diffs from lane/mechanical-dispatcher to main

Ports 11 files (we:scripts/conveyor/queue-scope.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/verify-dispatch.mjs, we:scripts/conveyor/infra-blocked.mjs, we:scripts/conveyor/poc-branch-sync.mjs, we:scripts/conveyor/main-ref-sync.mjs, we:scripts/lib/poc-branches.mjs, we:scripts/lib/poc-branches.json, we:scripts/lib/swept-repos.json) plus their tests. queue-scope is new and imported by the watches, reconcile-pass and the runner. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/infra-blocked.test.mjs we:scripts/conveyor/__tests__/main-ref-sync.test.mjs we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs we:scripts/conveyor/__tests__/queue-scope-wiring.test.mjs we:scripts/conveyor/__tests__/queue-scope.test.mjs we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Resolution (2026-09-24)

Net-new (unchanged on main since merge base `ca7e68b71`, so ported as-is from `600acc14f`): `we:scripts/conveyor/queue-scope.mjs`, `we:scripts/conveyor/poc-branch-sync.mjs`, `we:scripts/conveyor/main-ref-sync.mjs`, `we:scripts/lib/swept-repos.json`, and their three tests. `we:scripts/conveyor/infra-blocked.mjs` was already faithfully ported by an earlier slice (its diff against the snapshot carries only later main-only changes) — untouched here.

Queue-scope wiring restored onto main's CURRENT (independently-evolved) `we:scripts/conveyor/duplicate-pr-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/parked-pr-progress-watch.mjs` and `we:scripts/conveyor/verify-dispatch.mjs`: each had already been ported from this same snapshot by an earlier slice with the queue-scope import and `queueScope` param left out (that module did not exist on main yet); this resolution adds back the import + param + `scopePrsToQueue`/`laneInQueueScope` call, preserving every one of main's own later additions (gh-throttle, bounded-child timeouts, #3878's `runVerifyDispatch` extraction, etc.) untouched.

**we:scripts/conveyor/__tests__/queue-scope-wiring.test.mjs scope note.** The prototype's own copy of this test also covers `we:scripts/conveyor/reconcile-pass.mjs` and `we:skills-src/conveyor/runner.mjs`'s `--scope-to-queue` flag. Neither is wired here: main's `we:scripts/conveyor/reconcile-pass.mjs` (authored independently under #3296/#3499, never a port of the prototype's file) and `we:skills-src/conveyor/runner.mjs` are explicitly we:backlog/3487's own scope, and we:backlog/3486's resolution note explicitly routes "queue scope … in `we:skills-src/conveyor/runner.mjs`" to #3487, which lists this item's own `we:scripts/conveyor/queue-scope.mjs` as one of its import blockers (i.e. #3911 lands the module, #3487 wires it into the runner/reconcile-pass afterward). Ported `we:scripts/conveyor/__tests__/queue-scope-wiring.test.mjs` covers only the four watches this slice actually wires (duplicate-pr-watch, parked-pr-conflict-watch, parked-pr-progress-watch, verify-dispatch) — the reconcile-pass/runner describe blocks are left for #3487 to add when it lands that wiring.

Gate on main's tree: `npm run check:standards` — 0 errors; `npm test -- run` — 559 files / 15827 passed, 6 skipped, 0 failed.
