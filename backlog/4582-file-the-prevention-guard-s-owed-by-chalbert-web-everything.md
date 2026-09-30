---
bornAs: xkecc48
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3069's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:335` — When a heal has a declared scope that names no WE path, log or escalate instead of silently treating it as unscoped. A lint or test asserting the launcher always passes a non-empty scope for heal dispatches would also catch it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3069@c6242481e154f15781db807ca3526b74ba6c4981

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
