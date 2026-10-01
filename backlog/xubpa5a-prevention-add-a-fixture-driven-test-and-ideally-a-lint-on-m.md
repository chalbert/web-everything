---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/review-set-label.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a fixture-driven test (and ideally a lint on marker constants) asserting that comments mentioning t… (from chalbert/web-everything#3328 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/jury-core.mjs:2368` — Add a fixture-driven test (and ideally a lint on marker constants) asserting that comments mentioning the marker name in prose parse as 'no record', distinct from a truncated opening delimiter.
2. `we:scripts/operations/review-pr.mjs:1614` — Test matrix over every confirm option (accept/changes/abstain) × pending/blocked referral state asserting only accept is refused.
3. `we:scripts/lib/jury-core.mjs:2370` — Filter referral records by comment author (the daemon/reviewer actor), or sign the record with a harness-held secret/session stamp. Add a forged-comment regression test. A lint cannot decide this, so a review lens on 'trust read from user-writable surfaces' is the cheapest guard.
4. `we:scripts/lib/jury-core.mjs:2354` — Author-filter comments before parsing (same guard as the finding above), plus a test with a foreign-author malformed marker.
5. `we:scripts/review-set-label.mjs:1894` — Require the card to reference the finding key/PR, read it from the base branch (git show origin/main:path), and add a negative test with an unrelated card.
6. `we:scripts/operations/review-pr-io.mjs:528` — Add a deterministic concurrency regression that interleaves two runs before persistence and asserts exactly one dispatch, backed by an atomic claim keyed to repository, PR, head, and referral set.
7. `we:scripts/operations/review-pr.mjs:1614` — A test in `we:review-pr.test.mjs` verifying that resuming with `{ value: 'changes' }` succeeds and records the rejection despite pending referrals.
8. `we:scripts/lib/jury-core.mjs:2390` — A test in `we:jury-core.test.mjs` where a PR has an unresolved referral on commit A, then commit B is pushed fixing the defect, asserting that `mandatoryReferralState` returns no pending referrals.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3328@211e1cc8f9316bc6495d8f936e5cab0e884757c5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
