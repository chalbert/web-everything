---
bornAs: xdu61tj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3079's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:451` — A table-driven test over attempt-counting sources (core TTL retirement same tick, core TTL retirement earlier tick, session-dead), asserting each run is counted once. Better: key the tally by run or attempt id rather than incrementing a counter.
2. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1600` — Add a daemon-level test that runs the tick repeatedly with a persistently dead session and asserts the launch count stops at the retry cap. More generally, any claim of a bounded retry should get a test that exhausts the bound.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3079@205c57c84d43c26174dc658b88e453a3546444bd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
