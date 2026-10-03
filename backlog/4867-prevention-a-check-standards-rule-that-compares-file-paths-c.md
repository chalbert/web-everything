---
bornAs: xnyhtfu
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — A check:standards rule that compares file paths cited in a backlog card body against its scope frontmat… (from chalbert/web-everything#3485 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:5` — A check:standards rule that compares file paths cited in a backlog card body against its `scope` frontmatter and warns on cited implementation paths missing from scope.
2. `we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:73` — When the implementation PR lands, add a test that the ruling path rejects an agent-authored or unattributed instruction and records the actor on the ruling. The cheapest guard now is one acceptance line on the card: 'ruling must be bound to the human operator identity, not agent-writable input'.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3485@dde1c0e8bd2638c66c73b5ed1c4cb5edda99c5a9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
