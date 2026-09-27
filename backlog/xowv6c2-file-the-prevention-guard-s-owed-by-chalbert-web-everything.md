---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-loop-policy.mjs", "we:scripts/operations/review-loop-cli.mjs", "we:scripts/lib/__tests__/review-loop-policy.test.mjs", "we:scripts/operations/__tests__/review-loop-cli.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2766's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/review-loop-policy.mjs:454` — Add a regression test in we:scripts/lib/__tests__/review-loop-policy.test.mjs that asserts cardCoversGuard returns false for two findings sharing a file:line but with unrelated `prevention`/`summary` text (e.g. requiring the anchor to also fold in a short content fingerprint of the guard text when a file:line collision occurs), captured as a deterministic unit test rather than left as a documented-only trade-off.
2. `we:scripts/operations/review-loop-cli.mjs:368` — Add a deterministic integration test requiring a distinct same-location guard to be filed before acceptance; when guard equivalence cannot be established, retain the new filing rather than suppressing it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2766@d2453a58216d6cc4b14a4e1f30c673451ca93485

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
