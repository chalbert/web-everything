---
bornAs: x1dgehb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3008's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:322` — Add a per-branch coverage threshold on we:skills-src/conveyor/build-dispatch-daemon.mjs, or a review-lens checklist item: every new durable-claim path needs an acquire, release-on-done and release-on-failure test.
2. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` — Add a deterministic regression test asserting the emitted model arguments and resolving them against a non-sonnet routing-table default.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3008@ec409f2d6bbea5a99ea4e07b3264b4433584691a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
