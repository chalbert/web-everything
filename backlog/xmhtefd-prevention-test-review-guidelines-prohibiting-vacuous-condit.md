---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/testing.md", "we:docs/agent/delivery-loop.md", "we:scripts/operations/__tests__/review-pr.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "0f7d4f1b50b82c6845e8008a312e3e3caab780fc"
tags: []
---

# Prevention — Test review guidelines prohibiting vacuous conditional assertions in favor of positive existence checks. (from chalbert/web-everything#3278 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/review-pr.test.mjs:3029` — Test review guidelines prohibiting vacuous conditional assertions in favor of positive existence checks.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3278@1cb73f1327d4f7aa687baf6304cee9e27b4dbedd

## Progress

Preparation inspection found a narrower gap than the mechanically filed premise suggests.

- **Old premise/scope:** the citation to `we:scripts/operations/__tests__/review-pr.test.mjs:3029` implied a vacuous conditional assertion needing prevention, scoped only to that test file.
- **Corrected premise:** the current guard at `we:scripts/operations/__tests__/review-pr.test.mjs:3026-3036` already asserts membership of every expected mandatory and advisory seat before inspecting requests. Its mandatory-seat condition therefore cannot silently skip a missing mandatory request. The remaining work is explicit, reusable review guidance favoring positive existence checks, with the guard made a clearer worked example; this is not a missing runtime seat-policy fix.
- **Source evidence:** the same membership assertion exists in delivering merge `606c47967b98a680948b517c62036b040231b5dc` (PR #3278). `we:docs/agent/delivery-loop.md:265-266` already warns about assertions in unentered branches and empty loops, but does not describe the positive-existence replacement. `we:docs/agent/testing.md` has no corresponding authoring recipe. `we:scripts/operations/review-pr.mjs:534` defines the advisory roster used by the guard. These observations come from reading the current files and the merged test, not from running a mutation or claiming the suite passes.
- **Corrected scope:** add the authoring rule to `we:docs/agent/testing.md`, extend the existing review warning in `we:docs/agent/delivery-loop.md` with a pointer, and clarify the existing guard in `we:scripts/operations/__tests__/review-pr.test.mjs`. No runtime source changes are required. The sole executable edit is itself the matching existing test file; documentation entries do not introduce unpaired production source.

## Design

Document a review rule: required subjects must be positively asserted to exist before their properties are checked. Replace `if (subject) expect(...)` with an unconditional existence assertion followed by an unconditional property assertion. For required collections, assert the expected membership or cardinality before iteration; a loop over an output-derived empty collection is not evidence. A legitimate conditional implication is allowed when its antecedent is not itself required by the contract; do not turn every conditional test into a blanket ban or invent a new runtime guarantee.

Keep the canonical recipe in `we:docs/agent/testing.md`, including absent-subject and empty-collection examples and the mutation question: does removing the required subject make this named test fail? Extend the existing warning in `we:docs/agent/delivery-loop.md` to require that check and link to the recipe. Preserve its explicit-skip guidance.

In the existing #4446 guard in `we:scripts/operations/__tests__/review-pr.test.mjs`, retain the expected-seat membership checks, then iterate `JUDGE_STEPS` directly to assert each mandatory request exists and has a falsy `gracefulOnUnavailable`. Retain the separate implication that any request with that flag belongs to `ADVISORY_SEAT_STEPS`. Do not require every advisory request to carry the flag: the existing test's contract is implication, not equivalence. No exported interfaces, persisted data, or review verdict behavior changes.

## MVP

1. **Must 1:** Author positive-existence and required-collection review guidance in `we:docs/agent/testing.md`, with bad/good examples and a negative mutation check.
2. **Must 2:** Connect the existing vacuity warning in `we:docs/agent/delivery-loop.md` to that guidance without duplicating the full recipe or banning legitimate conditional implications.
3. **Must 3:** Make the #4446 test in `we:scripts/operations/__tests__/review-pr.test.mjs` demonstrate unconditional checks over expected mandatory seats while preserving the advisory-only implication and full expected-seat membership checks.

Implement in that order and deliver as one documentation-and-test change. Size 3 remains appropriate: two documentation edits, one focused test refactor, and small negative probes. No runtime implementation or new lint engine is part of this item.

## Done when

1. **Musts 1-2:** The authoring guide contains the absent-subject and empty-required-collection counterexamples, positive replacements, and a named-test mutation requirement; the review guide links to it. Review these examples explicitly; a passing standards gate alone does not prove prose quality.
2. **Must 3:** Run Vitest against `we:scripts/operations/__tests__/review-pr.test.mjs`, selecting the test named “over every seat step reachable at confirm time”; it passes unchanged fixtures and fails each negative probe in the Test plan. The current test already catches missing seats, so do not misrepresent the baseline as a newly fixed runtime regression.
3. **Musts 1-3:** The affected full test file and `npm run check:standards` pass after all temporary mutations are removed. The diff contains only the scoped documentation/test edits and the runner-managed card changes.

## Test plan

Use the existing test in `we:scripts/operations/__tests__/review-pr.test.mjs`; invoke Vitest from WE with that file as its file argument and `-t 'over every seat step reachable at confirm time'` for focused probes.

- Baseline: all expected mandatory and opt-in advisory requests are observed; mandatory flags remain falsy and every truthy flagged request is advisory.
- Missing subject: temporarily delete one mandatory request from the captured request map before assertions. The named test must fail on required presence.
- Empty population: temporarily replace the captured request map with an empty map. The named test must fail, not pass with zero loop iterations.
- Wrong property: temporarily set one mandatory request's flag to true. The named test must fail on the mandatory prohibition.
- Restore all mutations and run the full existing test file. Do not run live providers or mutate review labels; the harness uses injected answers and in-memory state.

The first two probes should already fail before this change; their role is to preserve and demonstrate the existing protection while making the review rule explicit. The before/after gap is the missing guidance and the less-direct mandatory assertion structure, not a fabricated failing runtime test.

## Proof plan

Capture the focused baseline result, each deliberately red probe's named assertion, and the restored green focused/full-file results. Inspect the final diff to confirm that mandatory presence is asserted independently of observed output and that no advisory equivalence requirement slipped in. Check both documentation examples by removing their required subject/population and tracing the unconditional failure. Run `npm run check:standards` and record its actual result; distinguish unrelated failures from failures introduced here. Preparation has only inspected source; execution evidence belongs to the implementation pass.

## Follow-ups

No follow-up is required to deliver this guideline. A repository-wide conditional-assertion audit or AST-based lint rule would be separate work: conditional assertions can express valid implications, so a textual ban would overreach this card. Runtime changes to advisory availability policy are outside this goal.
