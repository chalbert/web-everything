---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/guard-1c-mutation-check.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3057's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/guard-1c-mutation-check.mjs:84` — Match each mutant report against baseline test identities filtered by mustKill, and add a deterministic regression test requiring rejection when any expected identity is absent.
2. `we:scripts/conveyor/__tests__/session-reaper.test.mjs:1500` — A shared transcript mock factory that enforces the correct schema and types, preventing tests from hand-writing incorrect JSON log entries and relying on parser fallbacks.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3057@8cb24579eff98681fe91ce7c57f550188e1b2c98

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
