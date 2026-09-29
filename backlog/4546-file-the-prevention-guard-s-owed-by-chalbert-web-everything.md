---
bornAs: x58u2h9
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/driver-watchdog.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/driver-watchdog.test.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2998's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/driver-watchdog.mjs:103` — Add a test that iterates `LAUNCH_KINDS` (mapped through `sessionSlugFor`) against `WATCHED_SESSION_KINDS`, replacing the hardcoded list in we:driver-watchdog.test.mjs. Consider a check:standards rule that flags any table keyed on launch kinds that is not derived from `LAUNCH_KINDS`.
2. `we:scripts/conveyor/tick-core.mjs:1285` — A strict review lens or standard requiring every behavioral guarantee stated in inline comments to have a 1:1 named test explicitly asserting it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2998@71f593e41895963f579481656b26f3a325b5a159

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
