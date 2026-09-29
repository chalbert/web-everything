---
bornAs: xkm60e4
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/__tests__/conveyor-state.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2853's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/conveyor-state.mjs:331` — When a producer omits fields for a reader, add a contract test that lists each consumer's read fields against the omitted set. A cheap dirty-lane signal, such as the free-lane list from #4122, could replace the git probe for `freeSlots`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2853@b854f1dbc204ad45935d80aa3a55a075c0d29697

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
