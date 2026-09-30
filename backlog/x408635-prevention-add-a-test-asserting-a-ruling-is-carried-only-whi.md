---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/stand-down-answer-core.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/stand-down-answer.md", "we:scripts/conveyor/__tests__/stand-down-answer-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a test asserting a ruling is carried only while its stand-down is the most recent resolved hold, or… (from chalbert/web-everything#3225 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/stand-down-answer-core.mjs:73` — Add a test asserting a ruling is carried only while its stand-down is the most recent resolved hold, or expire it on a new head or round.
2. `we:scripts/conveyor/reconcile-core.mjs:648` — Add a check:standards rule or test that every consumer of the stand-down marker goes through one resolved-aware helper.
3. `we:scripts/conveyor/stand-down-answer-core.mjs:28` — Add a test or check that an answer posted by the same identity a fix agent uses is not sufficient on its own. Options: a HMAC or nonce record that only the operator CLI can produce, or a trusted-login set that excludes the fix-agent principal. Until then, add a security-lens checklist item: any new marker that gates human escalation must name which principals can mint it.
4. `we:scripts/conveyor/stand-down-answer.md:18` — Add a deterministic, parameterized reconcile test combining a valid operator answer with each independent refusal and asserting that the refusal survives and no fix dispatch is emitted.
5. `we:scripts/conveyor/stand-down-answer-core.mjs` — A deterministic unit test simulating GitHub's whitespace/newline normalization on comment bodies to verify resilient parsing (e.g., parsing the base64 payload and ensuring it matches the core fields, rather than requiring strict equality of the entire comment body).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3225@89a8c8f0a34980f7ade2105c13a868c34ecafdb7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
