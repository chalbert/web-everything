---
bornAs: xjptsg1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4683-prevention-add-a-check-standards-rule-not-just-the-g6-audit.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — A prepare-stage rule that, for any card proposing a new failing gate, requires a stated count of existi… (from chalbert/web-everything#3632 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4683-prevention-add-a-check-standards-rule-not-just-the-g6-audit.md:47` — A prepare-stage rule that, for any card proposing a new failing gate, requires a stated count of existing violators on main and either a changed-only/scoped boundary or a named remediation lane. This could be a prepare checklist item enforced by a write-gate that checks the card for a 'baseline violators' line.
2. `we:backlog/4683-prevention-add-a-check-standards-rule-not-just-the-g6-audit.md:46` — Add a test-plan case to the card for 'legacy defective card touched only in frontmatter stamps' that states the intended result. Alternatively, scope the rule to defects newly present in the diff (head defective and base clean) rather than to touched files.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3632@49284f2a3b6bd1ccca87ba83533d47fb3f83a5b3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
