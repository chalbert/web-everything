---
bornAs: xc5drvb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4841-split-a-pr-as-a-declared-operation-reviewer-recommends-it-op.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a check:standards rule requiring any card that declares an AI-callable operation with a human-confi… (from chalbert/web-everything#3369 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4841-split-a-pr-as-a-declared-operation-reviewer-recommends-it-op.md:12` — Add a check:standards rule requiring any card that declares an AI-callable operation with a human-confirmation step to carry a Must line saying the operation refuses without a recorded confirmation. Until that gate exists, a review lens can check for it. The card's own hint already points at this class: a Must line for what happens on error (refuse).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3369@e2529f58bf41d614e4b84eaba68b2b346f480bd5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
