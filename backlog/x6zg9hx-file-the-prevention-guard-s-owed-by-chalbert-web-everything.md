---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/hung-session.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2939's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/hung-session.test.mjs` — Require branch coverage or mutation testing on the `Date.parse` fallback logic to ensure parsed entries without timestamps are actually tested.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2939@2789b3efcec6d5140dcb54f4763b793752353d86

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
