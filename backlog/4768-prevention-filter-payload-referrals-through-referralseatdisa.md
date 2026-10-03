---
bornAs: xas1h1k
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Filter payload.referrals through referralSeatDisabled as well, or skip re-adding any key already presen… (from chalbert/web-everything#3743 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-pr-io.mjs:574` — Filter `payload.referrals` through `referralSeatDisabled` as well, or skip re-adding any key already present in a `dropped` list at the same head. Add a test covering the disabled-seat-with-non-empty-payload case.
2. `we:scripts/lib/jury-core.mjs:2309` — Put one gate on referral-record comments: the reader accepts them only from trusted bot authors. Failing that, add a negative test that a `dropped` entry for a currently-enabled seat is refused. The trust boundary on comment authorship belongs in a `check:standards` rule or a reader-level test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3743@323e695c83757bea4aeb41916d69ca9ae22515b0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
