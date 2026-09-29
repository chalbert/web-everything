---
bornAs: x0gr5d5
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/main-staleness.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/lib/__tests__/main-staleness.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2916's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-dispatch.mjs:405` — Add a deterministic test that lists the security-relevant non-import inputs a review session loads (`.claude/settings*.json`, hook scripts named in it) and asserts each is on the review path. Alternatively, have `isReviewCodePath` treat every `.claude/**` file and every hook command target as on-path.
2. `we:scripts/operations/review-dispatch.mjs:415` — A unit test explicitly asserting that `isReviewCodePath` returns false for known decoy file names (e.g., `we:preview-site.mjs`).
3. `we:scripts/lib/main-staleness.mjs:215` — A lint rule enforcing consistent usage of injected loggers over direct `process.stderr.write` calls.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2916@09fe9db61465beae917ef665f5df744c2ce1d6ba

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
