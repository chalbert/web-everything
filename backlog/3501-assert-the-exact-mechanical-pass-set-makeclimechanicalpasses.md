---
bornAs: xb4fjir
kind: story
size: 2
status: resolved
dateOpened: "2026-09-05"
dateStarted: "2026-09-05"
dateResolved: "2026-09-05"
tags: []
scope: ["we:skills-src/conveyor/__tests__/runner.test.mjs"]
---

# Assert the exact mechanical-pass set makeCliMechanicalPasses invokes each tick

Review finding on PR #1949 (which added we:scripts/conveyor/duplicate-pr-watch.mjs): we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses has no test asserting which script paths it actually runQuiet()-invokes each tick. Deleting any one runQuiet(...) line (a refactor, a reorder, an accidental drop) currently reddens nothing in we:skills-src/conveyor/__tests__/runner.test.mjs, which only mocks execFileSync generically. Add one test (for the whole function, not per-pass) that mocks execFileSync and asserts the exact set/order of relative script paths makeCliMechanicalPasses invokes, so a future silent drop of any mechanical pass (e.g. we:scripts/conveyor/duplicate-pr-watch.mjs or we:scripts/conveyor/parked-pr-conflict-watch.mjs) is caught mechanically instead of by grep.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/runner.test.mjs` passes, including the new
   test asserting the exact ordered `execFileSync` call list `makeCliMechanicalPasses` produces for a plain tick.
2. **Executable** — confirmed by hand: commenting out any one `runQuiet('conveyor/<pass>.mjs', …)` line in
   `we:skills-src/conveyor/runner.mjs` reddens that new test (verified live for `we:duplicate-pr-watch.mjs`
   during this item's own build — restored afterward, no functional change shipped here beyond the test).
3. **Executable** — `npm run check:standards` stays green.

## Progress

- Added one test to the existing `makeCliMechanicalPasses` describe block in
  `we:skills-src/conveyor/__tests__/runner.test.mjs`: mocks `execFileSync`, runs a plain tick (empty
  `we:reconcile-pass.mjs` plan — no reviews owed, so the `gh repo view` resolution never fires either), and
  asserts the complete ordered call list byte-for-byte. Verified the mutation-check by hand: temporarily
  commenting out the `we:duplicate-pr-watch.mjs` `runQuiet(...)` line reddened exactly this new test (one fewer
  entry in the asserted list) and nothing else; restored before committing.
