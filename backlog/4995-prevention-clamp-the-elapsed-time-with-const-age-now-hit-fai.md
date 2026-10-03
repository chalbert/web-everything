---
bornAs: xkszl48
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Clamp the elapsed time with const age = now - hit.failedAt; cooling = age = 0 && age COOLDOWN, and add… (from chalbert/web-everything#3805 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/pr-limit.mjs:197` — Clamp the elapsed time with `const age = now - hit.failedAt; cooling = age >= 0 && age < COOLDOWN`, and add a future-timestamp test. For the broader class (persisted timestamps compared to `Date.now()`), a review-lens note is enough.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3805@ad9ef3a8748a29d0c40234a67462a426ea48ac94

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
