---
bornAs: xus9wgs
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs", "we:scripts/conveyor/ci-heal-escalation-mark.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3186's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-heal-run.mjs:107` — In `buildCiHealEscalationComment`, collapse the reason to a single line, truncate it, and redact URLs/credentials. Add a unit test with a multi-line 10 KB reason containing a fake marker line.
2. `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs:98` — Add a deterministic test with an injected clock or lock-wait adapter that verifies acquisition stops at the caller’s deadline independently of the scan timeout.
3. `we:scripts/conveyor/ci-heal-escalation-mark.mjs:237` — A module import/export validation step in `check:standards` (like `eslint-plugin-import`'s `named` or `no-unresolved` rules) that statically verifies named imports exist in their target modules.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3186@8ea5f49a4291163851018d6af685155d068598d7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
