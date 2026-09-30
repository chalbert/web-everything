---
bornAs: xrh2isv
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/launchd/com.we.build-dispatch-daemon.plist.example", "we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3014's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/launchd/com.we.build-dispatch-daemon.plist.example:41` — A standards check that fails when a CLI flag or env default in a daemon changes while a `*.plist.example` or docs mention of the old value remains, or a card-template checklist item to grep the flag name repo-wide.
2. `we:scripts/conveyor/build-dispatch-policy.mjs:322` — A mutation-testing pass or a review lens that requires one test per branch of a new guard condition.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3014@f1fc21b53c4beec3278357f8a4ecb82e90760ee4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
