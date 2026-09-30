---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lane-whois.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3048's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lane-whois.mjs:60` — Add a contract test that pins a recorded `claude agents --json` fixture covering every state and status value, and fails when an unclassified value appears. Or classify unknown non-terminal states as running, with a deny-list for idle only.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3048@ac8e791290bee8e970a330059ec7b8421d89b50a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
