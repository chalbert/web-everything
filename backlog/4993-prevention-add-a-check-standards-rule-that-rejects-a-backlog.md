---
bornAs: xdogy0h
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4991-configurable-verify-mode-for-agent-pushes-parallel-for-pr-fi.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a check:standards rule that rejects a backlog card whose Done-when still contains the 'TODO: a comm… (from chalbert/web-everything#3811 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4991-configurable-verify-mode-for-agent-pushes-parallel-for-pr-fi.md:14` — Add a check:standards rule that rejects a backlog card whose Done-when still contains the 'TODO: a command that fails before' placeholder. Have it also require the two Must lines when the card text mentions loosening a verify, refuse or gate step.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3811@467c7f26b19494f4a73d71b51398d81dc097342a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
