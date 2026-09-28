---
bornAs: xoebb7z
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2834's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/session-reaper.mjs:481` — Extract the shared activity-time primitive and add a targeted duplicate-code check. Backlog item 4312 already records the extraction, but its executable guard remains TODO.
2. `we:scripts/conveyor/__tests__/session-reaper.test.mjs` — Add isolated timestamp-refusal fixtures with legacy or matching identities, and a targeted mutation gate requiring those named tests to fail when Guard 1(c) or its pass-level wiring is disabled.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2834@6bb04de4350d279d600ea0d5690a19e97c67cc7d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
