---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xfkqowg-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a standards check that a backlog card with an "Operator ruling" section has its Fix lines marked su… (from chalbert/web-everything#3477 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xfkqowg-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:22` — Add a standards check that a backlog card with an "Operator ruling" section has its Fix lines marked superseded or rewritten. Failing that, require the implementing lane to write one authoritative "Plan" section and mark the older text as history. Also fill in the Done-when executable line before the card goes ready.
2. `we:backlog/xfkqowg-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:26` — Require the card's Must lines to be filled in, with an error-path line and a non-code-input line, before the card can be marked ready. A check:standards rule on cards whose Must section still contains TODO would enforce this.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3477@096956089e23a1440449e9b83ce55fc647c62b78

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
