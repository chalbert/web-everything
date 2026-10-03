---
bornAs: xqnqf5m
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/__tests__/daemon-live-smoke.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a check:standards rule or a test that enumerates every non-test caller of dispatchReview, dispatchR… (from chalbert/web-everything#3633 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/daemon-live-smoke.mjs:372` — Add a check:standards rule or a test that enumerates every non-test caller of `dispatchReview`, `dispatchReviewJob` and `dispatchReviewByMode`. It would require an explicit `ciGate` or a documented opt-out. Make `checkFilled` throw when the prompt is empty, so a skipped dispatch cannot pass vacuously.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3633@b1aa49318a23d7a829e4666cc2f2b714cc3f2eaf

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
