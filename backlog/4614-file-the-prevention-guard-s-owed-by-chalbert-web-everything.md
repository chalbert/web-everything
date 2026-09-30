---
bornAs: xmlowwn
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3104's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1047` — Add a test that feeds a future-dated commit and a back-dated committer date, and clamp the value to `<= now` or prefer a server-side timestamp (push event time or check-suite `created_at`) over the commit date. A deterministic gate would be a lint rule that flags reading `commit.committer.date` or `author.date` in daemon eligibility code without a clamp.
2. `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs:36` — Convention: every fail-closed guarantee stated in we:docs/agent/testing.md must name a test at each layer that repeats the guard. A review lens is the cheapest option, since no script can decide this.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1049` — Running the unit test locally, which would have deterministically crashed with this error, or using static TypeScript types for the `row` payload to catch undefined properties.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3104@427162ba0cf4038af9be74b1388c53c983593ee9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
