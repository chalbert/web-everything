---
bornAs: xculsrx
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "e8ffa79c46f8e76fcbfb3e3aca60c3956a992098"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3036's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:446-477` — Add a test, and ideally a helper, that fixes the reason sanitize-and-cap in one place and asserts that every `holdWorkerDecline` entry's `reason` is at most 600 characters. That test would go red on any branch that passes a raw worker message.
2. `we:scripts/operations/probation-build-run.mjs:753-759` — Sanitize inside `holdWorkerDecline`, which is the single sink for hold reasons: apply `sanitizeHoldReason` there so no caller can persist raw worker text. Add a unit test that feeds an oversized, multi-line reason and asserts the stored hold reason is bounded and flat.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3036@a89d6223ca728c0f1c347ad4562aa805d2ceb86a

## Progress

Preparation research corrected the original premise without changing the prevention goal:

- **Old premise/scope:** the review cited `we:scripts/operations/probation-build-run.mjs:379` and `we:scripts/operations/probation-build-run.mjs:382`, requesting a shared sanitize-and-cap guard and sink protection, with implementation and tests confined to the runner and its existing test file.
- **Corrected premise:** the four hold-producing branches now sit at `we:scripts/operations/probation-build-run.mjs:446-477` and `we:scripts/operations/probation-build-run.mjs:511-516`; the real sink is at `we:scripts/operations/probation-build-run.mjs:753-759`. Preparation declines cap an excerpt at 1200, ordinary declines cap an excerpt at 600 before adding the prefix, already-done routing retains raw worker text, and envelope routing supplies a generated reason. The sink passes `entry.reason` unchanged to persistence. The existing test at `we:scripts/operations/__tests__/probation-build-run.test.mjs:203-213` explicitly expects 617 characters, so it does not enforce the requested total cap.
- **Source evidence:** `sanitizeHoldReason` already exists in `we:scripts/operations/build-dispatch-hold-route-land.mjs:139-152`, including flattening, markup neutralization, path handling and a configurable cap. `planHoldRouting` in `we:scripts/conveyor/build-dispatch-hold-router.mjs:81-89` classifies the original reason and retains it. `placeBuildDispatchHold` in `we:scripts/conveyor/build-dispatch-claim.mjs:139-145` converts reasons to strings without sanitizing. These are read-only dependencies for this item.
- **Corrected scope:** retain the two declared files. Reuse the existing sanitizer without modifying shared routing or hold-storage policy. Preparation coverage already lives in `we:scripts/operations/__tests__/probation-build-run.test.mjs`; no separate preparation test file is needed. The goal is not already delivered: both the raw sink and the 617-character expectation remain in the current source.

## Design

Enforce a maximum of 600 characters on the **complete hold reason**, including any `worker-declined: ` prefix, across this runner's four hold-producing branches. In `we:scripts/operations/probation-build-run.mjs`, introduce one pure entry-normalization helper that returns a copy of the routed entry with `reason: sanitizeHoldReason(entry.reason, { max: 600 })`. Keep `num`, `route`, `commit`, and other metadata unchanged. Reuse this helper at every call to `io.holdWorkerDecline` and inside the real `holdWorkerDecline` sink immediately before persistence. This gives fake-IO branch tests an observable invariant and independently protects the real sink from future callers passing raw text.

Classify the original report before normalizing the routed entry. In particular, already-done commit evidence can occur after character 600: truncating before `planHoldRouting` would change the route or lose the commit. Keep the original routed entry available for `landAlreadyDone` and existing finding generation; pass a normalized copy to the hold sink. The stored reason is a bounded display excerpt, while the landing pass retains the full evidence and its existing validation. Preserve existing routing, fallback-message, reservation ordering and error behavior. Do not change the shared sanitizer's defaults or the general dispatch hold API.

## MVP

1. Add the shared normalization helper in `we:scripts/operations/probation-build-run.mjs` and apply it after routing at all four hold calls: preparation refusal, already-done report, ordinary no-change decline, and envelope overflow.
2. Apply the same helper in the real sink before `placeBuildDispatchHold`. Keep reservation failure and persistence failure handling intact.
3. Extend `we:scripts/operations/__tests__/probation-build-run.test.mjs` with branch and real-sink regressions. Replace the 617-character expectation with the total 600-character contract; adjust assertions that previously assumed the stored excerpt always equals the longer diagnostic text.

## Test plan

All matching source coverage belongs in the existing `we:scripts/operations/__tests__/probation-build-run.test.mjs` for `we:scripts/operations/probation-build-run.mjs`.

- Use the existing fake-IO build and preparation fixtures to exercise all four hold-producing branches. Assert every captured hold entry has a reason of at most 600 characters, with no control characters, line separators, raw angle brackets or backticks. Include an oversized multi-line worker message with markup and paths; assert the prefix counts toward the cap.
- Cover short, exactly-600 and over-600 final reasons, empty/whitespace reports and the existing fallback. Verify the normalizer preserves metadata and does not mutate its input. Repeated normalization must preserve the sanitized result.
- Put an already-done citation after character 600. Assert classification and the landing call still receive the correct commit and original evidence, while the hold receives the bounded reason. Keep the existing refused-citation regression green.
- Exercise the actual `realIo().holdWorkerDecline` method with reservation and persistence dependencies mocked in an isolated module import. Feed it a raw oversized multi-line entry directly, bypassing branch normalization, and inspect the reason passed to the persistence function. Assert the same sanitation/cap and unchanged item number. Never use the live hold ledger. Include reservation refusal (no persistence) and persistence failure (existing error).
- Confirm the ordinary decline, preparation refusal, already-done landing and envelope routing retain their existing outcomes and card-handling behavior.

## Proof plan

During implementation, first add the regression assertions and run the focused Vitest file: the current 617-character decline and raw real sink must fail the new contract. Save that failing output, then apply the implementation and rerun the same file to demonstrate green. Use the repository-relative equivalent of `we:scripts/operations/__tests__/probation-build-run.test.mjs` as the argument to `npx vitest run` from the WE root.

Run `npm run check:standards` after implementation. Review captured hold arguments for all four branches and the mocked persistence call for the direct real-sink probe; a sanitizer-only unit test is insufficient proof that the sink uses it. No real worker, dispatch hold, commit, push or PR is required for this proof. Preparation itself records source observations only; implementation red/green evidence remains owed.

## Follow-ups

No additional policy decision or prerequisite is needed. Broader dispatch producers, shared hold-store limits, and changes to card-finding or diagnostic excerpt lengths are outside this runner-specific prevention guard. If implementation uncovers a distinct defect there, record it separately rather than expanding this item's scope.

## Done when

1. The focused Vitest command described above fails against the original runner and passes after implementation, demonstrating a flat sanitized reason of at most 600 characters at every runner hold call and at the real persistence boundary.
2. Already-done routing and citation validation still use complete evidence; all four existing routing outcomes and error behavior remain covered.
3. `npm run check:standards` passes. Both review requests are discharged by the shared normalizer, sink enforcement and executable regression coverage.
