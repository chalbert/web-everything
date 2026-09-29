---
bornAs: xtx1z8m
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2898's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs:65` — A Proxy-based contract test that passes a wrapped PR object into `normalizeOpenPrs` to dynamically record and assert every property actually accessed during execution, failing if an un-provided field is read.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2898@57f200f0c4cc0ff2bead788f24ee003e7b342ef0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
