---
bornAs: xc39mwu
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a sweep-level test: a marked recovery tip over N ticks must either be refused with an escalation ki… (from chalbert/web-everything#3253 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-red-recovery-watch.mjs:838` — Add a sweep-level test: a marked recovery tip over N ticks must either be refused with an escalation kind or leave a durable terminal marker. Alternatively, have pushMissingRunCommit return a distinct non-deferred refusal for the marked-tip case so the planner can cap it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3253@dfc9aa12c5b24bb285cb2a0096f91af52a64f43b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
