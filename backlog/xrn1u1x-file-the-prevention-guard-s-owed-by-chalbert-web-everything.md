---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3087's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs:134` — For each guarantee stated in the Done-when list, require a negative test on fresh state and a mutation check that the guard line reddens it. Failing that, add a review lens item: a negative assertion must not share state with a prior terminal scenario.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1004` — Wrap per-item evidence collection in a per-item try/catch that records an error row, and add a test with one throwing PR next to a healthy one.
3. `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs:107` — Add a parameterized integration test with a dead recorded wrapper and a distinct current author stamp whose liveness is true or unknown; assert that dispatch never occurs.
4. `we:skills-src/conveyor/build-dispatch-daemon.mjs:934` — A deterministic linter rule or standard check requiring independent state updates or resilient try/catch blocks for sequential side-effect API calls, ensuring partial success is recorded.
5. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1010` — A lint rule forbidding unguarded subprocess executions (`gh`, `execFileSync`) inside loops processing multiple independent items.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3087@4468e1419a14944d40bf590928e091bae7491514

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
