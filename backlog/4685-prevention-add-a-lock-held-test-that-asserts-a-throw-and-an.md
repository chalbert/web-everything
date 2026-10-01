---
bornAs: x1vkzk7
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/lib/model-probation.mjs", "we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs", "we:scripts/lib/__tests__/model-probation.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a lock-held test that asserts a throw and an unchanged store. For the class, a review-lens rule: ev… (from chalbert/web-everything#3234 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/run-scorecard-store.mjs:340` — Add a lock-held test that asserts a throw and an unchanged store. For the class, a review-lens rule: every 'refuses / fails closed' sentence in a doc comment must name a test that exercises the refusal branch.
2. `we:scripts/conveyor/run-scorecard-store.mjs:342` — Add a deterministic lock-acquisition-failure test asserting that the helper throws and leaves the store unchanged; verify it fails when requireLock is removed.
3. `we:scripts/lib/model-probation.mjs` — A test asserting that a MERGED PR with a `review:accepted` label whose timestamp is older than `launch.scoredAt` is left pending or marked as an unreviewed merge.
4. `we:scripts/lib/model-probation.mjs` — A unit test verifying that a PR with exactly 100 `changedFiles` and exactly 100 items in `pr.files` evaluates as `complete` and does not trigger a critical miss.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3234@8ebbd4bf827297b675e420b0c151eb442cee4b40

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
