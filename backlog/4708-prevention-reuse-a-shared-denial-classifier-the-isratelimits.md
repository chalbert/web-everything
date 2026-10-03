---
bornAs: x2kmk7v
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/required-status-checks.mjs", "we:scripts/lib/__tests__/required-status-checks.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Reuse a shared denial classifier (the isRateLimitShaped guard in looksLikePersonalAccessDenial) instead… (from chalbert/web-everything#3672 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/required-status-checks.mjs:66` — Reuse a shared denial classifier (the `isRateLimitShaped` guard in `looksLikePersonalAccessDenial`) instead of ad-hoc status regexes. A unit test should assert that rate-limit 403s keep a live cache.
2. `we:scripts/lib/required-status-checks.mjs:68` — Classify on gh's structured HTTP status plus message (match `Resource not accessible by integration` or `Not Found`, exclude `rate limit`/`abuse`), and add a unit test asserting rate-limit 403 does not select `declared`. A table-driven classifier test in the existing file would be the cheapest gate.
3. `we:scripts/lib/required-status-checks.mjs:176` — Do not persist `declared` over an existing live entry (return it unsaved, or keep a separate declared key), and add a test that a live cache survives a subsequent denial.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3672@efb90dec3cc4dcb2453f0fdff18f4c03dcaa1fdd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
