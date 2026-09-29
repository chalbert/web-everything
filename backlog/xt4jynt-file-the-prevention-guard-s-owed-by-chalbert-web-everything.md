---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/lib/citation-check.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/lib/__tests__/citation-check.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2943's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:1783` — Extract a shared `runGitGrepGate(pattern, { emit })` helper into lib that all citation gates call. Unit-test its exit-1 and non-1 branches once, so every gate gets the guard.
2. `we:scripts/lib/citation-check.mjs:173` — A unit test asserting that an item missing `num` does not pollute the resolution set, or a structural validation/filter before calling `String()`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2943@eb93119506db1f5e3a8115135cb6ca5ceb46a1ad

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
