---
bornAs: xmw28yc
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4732-health-responder-verify-cached-journal-segments-before-trust.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a security-lens checklist item to the card/design template: "does any fallback path accept input th… (from chalbert/web-everything#3729 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4732-health-responder-verify-cached-journal-segments-before-trust.md:30` — Add a security-lens checklist item to the card/design template: "does any fallback path accept input that failed validation as a new trusted baseline?". Ideally encode it as a test-plan lint requiring a refusal test for every malformed-trust-metadata case.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3729@1da857f06036fc1df903359762161dc5b6c1466b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
