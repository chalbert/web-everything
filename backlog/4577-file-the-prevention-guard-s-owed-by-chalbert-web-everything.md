---
bornAs: xzsm1vx
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "939c3261800985624fff2cbfeeefe08dec93230f"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3053's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:872` (`cliDispatch`) — When a diff adds a catch-branch recovery, require a test whose injected dependency throws. A review-lens checklist item is enough; a deterministic gate is not practical here.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3053@843f1c1f8838490ea0026bce17542cc4a6cd7fd4

## Done when

1. The generated correctness panel mandate explicitly requires a throwing dependency test for an added catch-branch recovery, with assertions on the recovered result. A normal-return stub producing the same result is explicitly insufficient.
2. A focused regression in `we:scripts/lib/__tests__/review-core.test.mjs` fails against the old mandate and passes after the checklist addition. Existing mandate isolation, mutation-probe, and no-aim checks remain enforced.

## Progress

- Original premise/scope: the approval cited `we:skills-src/conveyor/build-dispatch-daemon.mjs:693` and scoped the daemon plus `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`, although the owed prevention was explicitly a review-lens checklist item.
- Corrected premise: inspecting the file at reviewed commit `843f1c1f8838490ea0026bce17542cc4a6cd7fd4` places that citation inside the `cliDispatch` catch that parses an exception's stdout. The same recovery now lives at `we:skills-src/conveyor/build-dispatch-daemon.mjs:872-877`. The planner-refusal case at `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1776-1782` injects an exec that returns JSON; it does not enter this catch. This is the concrete distinction the checklist must teach, not evidence that the daemon recovery itself needs changing.
- Corrected scope: implement the checklist in `buildPanelMandate` in `we:scripts/lib/review-core.mjs`, with its matching existing suite `we:scripts/lib/__tests__/review-core.test.mjs`. The shared mandate already carries a mutation probe, and the correctness charter asks that changed branches be exercised, but neither explicitly requires throwing the injected dependency for catch recovery. This is remaining prevention work, not an already-delivered guard.
- Compatibility evidence: `we:scripts/lib/__tests__/review-core.test.mjs:703-725` pins the no-aim correctness mandate against the historical fixture `we:scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt`. Preserve that historical fixture and explicitly account for the new checklist clause in the assertion; do not weaken the byte comparison.

## Design

Add one correctness-only checklist clause to `buildPanelMandate` in `we:scripts/lib/review-core.mjs`. Suggested wording: “CATCH-RECOVERY COVERAGE — When the diff adds a catch-branch recovery, require a test whose injected dependency throws (or rejects for an awaited dependency). Verify that the test enters the catch and asserts the recovered result and relevant side effects. A stub that returns the same result normally does not exercise recovery; cite the throwing test and its assertions, or report the missing coverage.”

Keep the existing mutation probe and review verdict rules intact. This is a reviewer instruction, not a deterministic detector of arbitrary catch coverage. No daemon behavior change or new dispatch path is needed. The previously selected checklist approach leaves no unresolved policy fork.

## MVP

1. Define the checklist text once in `we:scripts/lib/review-core.mjs` and append it for the correctness lens in `buildPanelMandate`, keeping the existing mutation probe last.
2. Add focused assertions in `we:scripts/lib/__tests__/review-core.test.mjs` for the trigger, thrown/rejected dependency, recovery assertions, and rejection of normal-return substitutes. Check that the clause appears once for correctness and is absent for other panel lenses.
3. Update the exact no-aim expectation in that same test file to include only this intentional clause at its insertion point. Retain the historical fixture and existing checks for unrelated mandate drift.

## Test plan

Run the Vitest suite at `we:scripts/lib/__tests__/review-core.test.mjs`. Add the new assertions first and observe failure against the current generated mandate; then implement the clause and rerun. Cover a default correctness mandate and one with goal/aim/round context to ensure optional context cannot suppress the checklist. Preserve the exact no-aim output check and the existing mutation-probe checks. Run `npm run check:standards` during implementation validation.

The scope pairs the only planned source change, `we:scripts/lib/review-core.mjs`, with its existing matching test file. The daemon and its suite are research evidence, not planned mutation targets.

## Proof plan

Capture the failing-then-passing focused test output and inspect an actual `buildPanelMandate({ lens: 'correctness' })` result. Confirm that it states the catch trigger, throwing dependency, recovered-result assertions, and normal-return exclusion. Remove only the new clause temporarily and verify the focused regression fails; restore it and rerun successfully. These probes prove delivery of the checklist, not guaranteed future reviewer compliance.

Use the `cliDispatch` example at `we:skills-src/conveyor/build-dispatch-daemon.mjs:872` to walk through the instruction: returning refusal JSON from exec covers the ordinary path, while throwing an error carrying refusal JSON in stdout enters the recovery. Record that distinction in review evidence without dispatching a live worker.

## Follow-ups

None required for this guard. A repository-wide catch-coverage detector, daemon behavior changes, and claims about reviewer effectiveness are outside this item. If implementation review finds a separate runtime defect, record its concrete evidence separately rather than expanding this checklist change.
