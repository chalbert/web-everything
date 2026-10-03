---
bornAs: xor2ch2
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4556-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a review-lens note or planner-contract test that every per-item validation failure in dispatchPlan… (from chalbert/web-everything#3504 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4556-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:33` — Add a review-lens note or planner-contract test that every per-item validation failure in dispatchPlan must become a held entry (e.g. `invalid-kind`), never a throw, with a regression that a bad card does not stop a valid sibling from launching.
2. `we:backlog/4556-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:37` — Add a spec-checklist or review-lens rule: a runtime validator over a multi-item queue must hold or skip the offending item, not throw for the batch. A dispatch-plan test should also assert that a valid sibling still plans alongside an invalid-kind card.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3504@35a8d9b4ff3c6b8992f0c5b02bd6a9217fb42207

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
