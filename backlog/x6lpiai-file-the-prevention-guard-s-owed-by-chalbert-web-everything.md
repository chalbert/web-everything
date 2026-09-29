---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/land-advance-io.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/__tests__/land-advance-io.test.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3001's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/land-advance-io.mjs:235` — Give `dispatchReview` no silent risk defaults: require an explicit signals object, or add a test that enumerates every `dispatchReview` caller and asserts it supplies the signals.
2. `we:skills-src/conveyor/review-daemon.mjs:357` — Add one integration test from `runReviewTick` with the real `dispatchReviewByMode` in session mode and a fake spawn, asserting the `--model` argv for a statute PR.
3. `we:skills-src/conveyor/review-daemon.mjs:357` — Add an end-to-end test that passes high-care signals through dispatchReviewByMode in both modes and asserts the model. Have dispatchReviewJob reject unknown options.
4. `we:scripts/operations/review-dispatch.mjs:594` — Add a deterministic gate or test that lists security-critical path globs and asserts they resolve to Opus for review. Derive care from the diff or CODEOWNERS rather than from the PR body alone.
5. `we:skills-src/conveyor/review-daemon.mjs:358` — An integration test or strict fixture validation that ensures mock API responses match the real output shape of the underlying tool (e.g., gh pr list).
6. `we:scripts/lib/provider-routing.mjs:469` — A table-driven test that enumerates every condition explicitly stated in the policy document and asserts its correct routing outcome.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3001@a0e515d40cbc1bebbb883cfeae3476602222005f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
