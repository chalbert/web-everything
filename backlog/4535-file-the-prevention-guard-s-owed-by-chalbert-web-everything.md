---
bornAs: xgyqyct
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2992's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:537` — Add a soak break that runs two consecutive timed-out retries against a fake slow pr-land and asserts at most one live pr-land per item. Alternatively, have infra-blocked hold a per-item in-flight lease (option (a)).
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:563` — Match `e.code === 'ETIMEDOUT'` only, and add a unit test for a foreign-SIGTERM error shape.
3. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:670` — Add a deterministic assertion that INFRA_RETRY_TIMEOUT_MS is a positive integer, alongside the existing interval upper bound, so changing the default to zero fails the named test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2992@67b93ba67a50d511437746eab2dda7e9e33da6a0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
