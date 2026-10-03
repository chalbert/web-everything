---
bornAs: xbtgn9q
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/check-backlog-item.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a table-driven test of citation phrasings to the content-lint test file, including , and, and, & an… (from chalbert/web-everything#3299 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards-rules.mjs:1038` — Add a table-driven test of citation phrasings to the content-lint test file, including `, and`, `and`, `&` and ranges. A property test over generated separator forms would also catch it.
2. `we:scripts/check-standards-rules.mjs:1065` — Extend the deterministic pending-lane exemption test with bare, inline-code, and Markdown-link references, plus unmarked controls that must still warn.
3. `we:scripts/check-backlog-item.mjs:93` — A simple CI smoke test executing `we:scripts/check-backlog-item.mjs` against a mock or known-good item to ensure it does not crash from undeclared variables.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3299@9857a8c31ece758908e5d730abe50c0e0c19c8cf

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
