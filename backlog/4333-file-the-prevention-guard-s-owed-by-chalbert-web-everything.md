---
bornAs: xrm17bt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2826's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-red-recovery-watch.mjs:461` — Add a unit test for reconcileAcceptanceAfterRebase that uses the REAL restampAcceptance/spawnCiHealRearm (only mocking spawnSync) with repo:null, asserting the child argv never contains the literal string 'null' as a --repo value -- the same class of gap every other 'falsy repo omits --repo' call site in this file already has covered by convention but not by an automated check.
2. `we:scripts/conveyor/ci-heal-mark.mjs:160` — Add an accepted-only rearm mode validated at the child's mutation boundary, with a deterministic interleaving test that changes accepted to changes between caller and child reads and asserts that changes remains.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2826@a028856115b05f478e82eb3071e4c25a887c4c04

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
