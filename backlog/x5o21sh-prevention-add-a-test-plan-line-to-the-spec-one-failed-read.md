---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xd6u5ta-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a test-plan line to the spec: one failed read mid-hold neither clears nor extends the episode, or a… (from chalbert/web-everything#3682 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xd6u5ta-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md:25` — Add a test-plan line to the spec: one failed read mid-hold neither clears nor extends the episode, or an explicit decision to clear it. A card-template prompt asking for each fail-open path's effect on any timer would cover the whole class.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3682@3a95e9a913904e8ced72c1cc5739faf66b26aaab

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
