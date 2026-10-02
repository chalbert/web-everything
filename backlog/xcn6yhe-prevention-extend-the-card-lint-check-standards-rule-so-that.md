---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xss880j-the-operation-runner-refuses-a-mutating-operation-from-a-che.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Extend the card-lint (check:standards) rule so that any card whose title or body contains 'refuses' or… (from chalbert/web-everything#3508 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xss880j-the-operation-runner-refuses-a-mutating-operation-from-a-che.md:12` — Extend the card-lint (check:standards) rule so that any card whose title or body contains 'refuses' or 'guard' must carry a Must line for the on-error behaviour. The Test line must then include an unknown or error-state fixture.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3508@ab0f0503b4fb43ce8762d21e6eb4512f658dbe04

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
