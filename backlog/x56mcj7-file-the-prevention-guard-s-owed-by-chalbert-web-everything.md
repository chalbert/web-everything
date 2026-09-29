---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2870's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:841` — Use a spy and assert that exec was not called, creating a deterministic regression gate for the no-execution contract.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2870@7911dc9462526db99e56d2ded8031fd37a6ff7fd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
