---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/__tests__/health-responder-core.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8d35ab340afcdf11f1e14ab490fdf7943f458f61"
tags: []
---

# Health responder: lane-release safety test fails when a precondition is removed

Follow-up from the #3490 advisory (2026-10-02). The lane safety test in we:scripts/conveyor/__tests__/health-responder-core.test.mjs:100 asserts only `hold`, so the later `adapter-unavailable` guard masks removal of release-lane predicates. Strengthen the tests to identify the refusing rule, while retaining a valid lane control that reaches the adapter guard.

## Design

Keep the implementation scope test-only: we:scripts/conveyor/__tests__/health-responder-core.test.mjs. Reuse its `input` helper and the existing `LANE1` case from we:scripts/conveyor/__tests__/fixtures/health-responder/replay.json; clone a fresh input for each case. No production or fixture-file change is needed.

Split the mixed lane/claim test into named lane cases and the existing claim regression. Use a parameterized lane matrix with the field and bad value in each test name. For each of `terminal`, `workerDead`, `clean`, `reachable`, and `reaperPermitted`, exercise false, null, and absent values; for `reserved`, exercise true, null, and absent values. These are the six strict checks in `predicate` in we:scripts/conveyor/health-responder-core.mjs:102. Every case must assert `decision: hold`, `rule: preconditions-unproved`, and `applied: false`.

Test `changedIdentity: true` separately: it must return `owner-or-terminal-hold`, not `preconditions-unproved`, because the common identity guard runs first in we:scripts/conveyor/health-responder-core.mjs:158. Add an explicitly named, unchanged `LANE1` control asserting `hold`, `adapter-unavailable`, and `applied: false`. This proves the negative cases are otherwise eligible to reach the adapter boundary. Preserve the claim cases and their specific `preconditions-unproved` expectations.

## MVP

1. Replace the lane loop's outcome-only assertion with independently named cases covering all six predicate fields and missing/unknown evidence.
2. Separate the replacement-identity case and pin its earlier refusal rule.
3. Add the valid-lane control and retain all existing claim coverage.
4. Collect mutation evidence using temporary copies or in-memory modules; ship only the test change. Do not enable an adapter or alter lane-release policy.

## Test plan

The matching test file and sole implementation scope entry is we:scripts/conveyor/__tests__/health-responder-core.test.mjs. Run that file with Vitest from the WE repository root (pass its repository-relative path to `npx vitest run`). Every matrix row must pass on the current production implementation. Retain the closed decision-table replay suite, including `LANE1`, and verify the claim cases still pass.

For each of the six release-lane conjuncts in we:scripts/conveyor/health-responder-core.mjs:102, remove only that conjunct in a disposable copy and rerun the matching named lane tests. Each mutant must fail on the corresponding unsafe-value rule assertion: it now returns `adapter-unavailable`. Also bypass the entire release-lane predicate: all predicate-negative cases must fail while the valid control still passes. Never leave a mutated production file in the delivered diff.

## Proof plan

Capture the unmodified targeted suite's passing result, then record each mutation, the named test that fails, and expected/actual rule. Restore the original source between mutations and rerun the targeted suite after the last one. The discriminating before/after evidence is that the old `hold` assertion survives the same mutation while the new `preconditions-unproved` assertion fails; an ordinary green test run alone does not demonstrate this regression fix. Review the final diff to confirm only we:scripts/conveyor/__tests__/health-responder-core.test.mjs changed during implementation. Run `npm run check:standards` as the delivery gate.

## Done when

- Must refuse false, unknown, or absent release-lane safety evidence with `preconditions-unproved`, and changed identity with `owner-or-terminal-hold`; tests assert the rule and no applied action.
- Must retain a valid lane control that reaches `adapter-unavailable` without releasing a lane.
- Must retain claim regression coverage and fail a named lane test for removal of each of the six release-lane predicate checks.
- Targeted Vitest tests and the standards gate pass with the original production source restored.

## Follow-ups

No prerequisite or unresolved policy fork remains. Implementing evidence adapters, changing release eligibility, and auditing other action families' outcome-only assertions are separate work; this item establishes mutation-sensitive lane safety coverage only.

## Progress

- Original premise/scope: we:scripts/conveyor/__tests__/health-responder-core.test.mjs:100 could pass with all release-lane preconditions removed; the suggested cases were dirty, reserved, live worker, and unreachable, with a valid control. Scope named only the test file.
- Corrected premise/scope: the cited file and test still exist. The six release-lane checks also include terminal status and reaper permission; cover all six plus missing/unknown evidence. Replacement identity is an earlier common guard, so its expected rule differs. Implementation scope remains the existing test file, which is itself the matching test path; production and replay fixture paths above are read-only evidence.
- Source evidence: we:scripts/conveyor/health-responder-core.mjs:102 defines the six conjuncts; we:scripts/conveyor/health-responder-core.mjs:158 rejects changed identity; we:scripts/conveyor/health-responder-core.mjs:184 rejects unproved predicates before the adapter guard at we:scripts/conveyor/health-responder-core.mjs:187. The valid lane replay is at we:scripts/conveyor/__tests__/fixtures/health-responder/replay.json:1927.
- Preparation probe: imported the real decision function and an in-memory copy replacing the entire release-lane predicate with `true`. The valid control returned `adapter-unavailable` in both. Each current lane predicate-negative case, plus terminal false and reaper permission false, changed from `preconditions-unproved` to `adapter-unavailable`; every old `hold` assertion still passed. Changed identity remained `owner-or-terminal-hold`. This confirms the gap is not already delivered. No production file was mutated and no implementation tests were added during preparation.
