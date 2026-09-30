---
bornAs: xg22wkd
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/verify-dispatch.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3138's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` — Use a controlled holder release: observe the dispatch offer while the slot remains held, release the holder, and assert that the logged start follows release; verify that an offer-time timestamp mutation fails the named test.
2. `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs:480` — A lint rule enforcing valid comparators (e.g., `eslint-plugin-sonarjs/no-inverted-boolean-check` or similar) or relying on a standard utility like Lodash `sortBy`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3138@fe43fa5fdb20e69e5a05e1eb597d9d9a29fa93e3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
