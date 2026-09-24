---
bornAs: xvrxwha
kind: story
size: 3
parent: "3443"
status: resolved
scope: ["we:scripts/operations/__tests__/action-cli.test.mjs", "we:scripts/operations/__tests__/coordination-root.test.mjs", "we:scripts/operations/__tests__/tick-mutex.test.mjs", "we:scripts/operations/__tests__/tick-throttle.test.mjs", "we:scripts/operations/action-cli.mjs", "we:scripts/operations/action-dispatch.mjs", "we:scripts/operations/action-ground-truth.mjs", "we:scripts/operations/action-record.mjs", "we:scripts/operations/action-store.mjs", "we:scripts/operations/coordination-lock.mjs", "we:scripts/operations/coordination-root.mjs", "we:scripts/operations/session-role.mjs", "we:scripts/operations/tick-mutex.mjs", "we:scripts/operations/tick-throttle.mjs", "we:scripts/operations/__tests__/action-records.test.mjs", "we:vitest.setup.ts", "we:vitest.config.ts"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Graduate coordination and action primitives from lane/mechanical-dispatcher to main

Ports 10 files (we:scripts/operations/coordination-root.mjs, we:scripts/operations/coordination-lock.mjs, we:scripts/operations/action-record.mjs, we:scripts/operations/action-store.mjs, we:scripts/operations/action-ground-truth.mjs, we:scripts/operations/action-dispatch.mjs, we:scripts/operations/action-cli.mjs, we:scripts/operations/tick-mutex.mjs, we:scripts/operations/tick-throttle.mjs, we:scripts/operations/session-role.mjs) plus their tests. Leaf layer: imports nothing else that is branch-only. Imported by the dispatch path, the review loop, tick-once and the runner. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/action-cli.test.mjs we:scripts/operations/__tests__/coordination-root.test.mjs we:scripts/operations/__tests__/tick-mutex.test.mjs we:scripts/operations/__tests__/tick-throttle.test.mjs we:scripts/operations/__tests__/action-records.test.mjs` passes on main's tree (this slice's tests; each fails before the port because its module is missing or differs). `we:scripts/operations/__tests__/coordination-cross-clone.test.mjs` dropped — see Wave B finding.
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Wave A finding (2026-09-24)

The first lane found three of this slice's tests import modules owned by later slices, so they could not pass on main. Moved them to the owning slices:
- `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` imports `we:scripts/operations/land-advance-io.mjs` → #3856
- `we:scripts/operations/__tests__/action-ground-truth.test.mjs` imports `we:scripts/operations/review-dispatch-wrapper.mjs` → #3908
- `we:scripts/operations/__tests__/session-role.test.mjs` imports `we:scripts/operations/detached-dispatch.mjs` → #3902

## Wave B finding (2026-09-24)

Two more hazards surfaced only once the kept tests actually ran on main's tree, both proven with a clean
`WE_COORDINATION_ROOT` temp dir (not machine-state artifacts):

1. **Missing global test isolation.** The branch's `we:vitest.config.ts` loads a `we:vitest.setup.ts` that hands
   every test its own throwaway `WE_COORDINATION_ROOT` (`beforeEach`/`afterEach`, `mkdtempSync`/`rmSync`) —
   neither file was in this slice's original scope. Without it, `we:scripts/operations/__tests__/action-cli.test.mjs`
   and `we:scripts/operations/__tests__/action-records.test.mjs` (whose `createActionStore()` calls take no
   explicit root) write real durable attempts to `~/workspace/.operations/coordination` and leak state across
   `it()` blocks in the same file — reproduced from a pristine temp dir: running `lists every attempt as JSON`
   then `settle uses default ports` in the same process fails the second test (`expected length 1 but got 2`)
   purely from state left by the first. Added both files to this slice (they're leaf/additive: `we:vitest.setup.ts`
   is a new file, and `we:vitest.config.ts` gains one `setupFiles` line; no existing test currently reads
   `WE_TELEMETRY` or relies on the real homedir coordination root inside a test). `we:scripts/operations/__tests__/coordination-cross-clone.test.mjs`
   also reads `process.env.WE_COORDINATION_ROOT` directly and requires this setup file to run at all.
2. **`we:scripts/operations/run-store.mjs` already diverged from the branch's assumption, by ratified design.**
   Its own docblock: runs are resolved by SCRIPT LOCATION (`<repo>/.operations/runs`), a gitignored
   session-local sidecar per platform decision `#state-lives-where-its-nature-dictates` (#2615/#2617) —
   deliberately NOT shared across checkouts. The branch's tests assume the opposite (a coordination-root-shared
   run store): `we:scripts/operations/__tests__/coordination-root.test.mjs`'s second case
   (`shares the run default but preserves the explicit run-store override`) and the whole of
   `we:scripts/operations/__tests__/coordination-cross-clone.test.mjs` assert exactly the cross-clone sharing
   `we:scripts/operations/run-store.mjs` now explicitly refuses to provide. `we:scripts/operations/run-store.mjs`
   is out of this slice's scope and its current behaviour is a ratified platform decision, not a bug —
   reconciling it is not this port's call. Dropped the one incompatible case from
   `we:scripts/operations/__tests__/coordination-root.test.mjs` and dropped
   `we:scripts/operations/__tests__/coordination-cross-clone.test.mjs` from this slice entirely (its whole
   premise no longer holds on main).
3. **`we:scripts/operations/action-ground-truth.mjs` imported a symbol that does not exist on main, crashing
   under real Node ESM.** At snapshot 600acc14f it read `isDispatchHandleLive` off
   `we:scripts/operations/dispatch-lane-io.mjs` (itself re-exporting from `we:scripts/operations/detached-dispatch.mjs`,
   #3902's file, blocked BY this item so it cannot land first). Main's own `we:scripts/operations/dispatch-lane-io.mjs`
   has never carried this symbol. Proven by importing the file directly under real Node ESM (not Vitest):
   `SyntaxError: does not provide an export named 'isDispatchHandleLive'` — silently tolerated only inside
   Vitest's lenient module transform (why `we:scripts/operations/__tests__/action-cli.test.mjs`/`we:scripts/operations/__tests__/action-records.test.mjs`
   still passed), not a real fix. Caught by the pre-PR independent review (#2170). Inlined
   `isDispatchHandleLive`/`isHandleListed`/`normalizeHandle`/`detachedHandlePid`/`DETACHED_HANDLE_PREFIX`
   verbatim from the snapshot straight into `we:scripts/operations/action-ground-truth.mjs` — no behaviour
   change, just relocated so the leaf actually loads before #3902 lands; #3902 should delete that block and
   restore the import once `we:scripts/operations/detached-dispatch.mjs` exists on main.
