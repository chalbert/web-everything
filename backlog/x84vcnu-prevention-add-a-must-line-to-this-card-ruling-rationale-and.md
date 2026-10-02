---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a Must line to this card: ruling rationale and evidence are rendered through the existing finding-b… (from chalbert/web-everything#3535 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xkoqlar-a-block-ruling-on-a-mandatory-referral-sends-the-pr-back-for.md:27` — Add a Must line to this card: ruling rationale and evidence are rendered through the existing finding-body sanitizer, with a regression test injecting a marker and directive. Longer term, add a lint or standards-gate rule that any reviewer-authored string interpolated into a published comment goes through a shared escape helper.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3535@b02a8a26356b8ba88dae5e1c1935e65830704abc

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
