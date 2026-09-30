---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/review-escalation.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3033's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/review-escalation.test.mjs:2826` — Extract the drain's verdict-decoration and pr-land's rubric-input assembly into pure functions, then test them by behaviour. A lint could also flag `readFileSync(...src).toContain(` wiring assertions.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3033@d80b906afed512c7b1403e09025b64d751ef9382

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
