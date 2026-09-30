---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3051's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:66` — Add a daemon test that runs two ticks with fallback active and asserts a re-probe path (a cooldown, a periodic probe, or a manual reset marker). Add a design-review lens: every circuit breaker needs a named half-open or reset path.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:878` — A lint or standards rule flagging direct reads of we:run-scorecards.json outside we:run-scorecard-store.mjs.
3. `we:scripts/operations/__tests__/probation-build-run.test.mjs:806` — Add a hook-surface-on-retry test, and a pattern for run-loop code that parametrises the existing security tests over attempt number.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3051@086fa8f3ed4b39e2813de8fa5c68a194ec6ba5a0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
