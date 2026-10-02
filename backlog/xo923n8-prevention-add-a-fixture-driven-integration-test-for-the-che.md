---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a fixture-driven integration test for the check-standards frontmatter scan and for check-backlog-it… (from chalbert/web-everything#3335 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:944` — Add a fixture-driven integration test for the check-standards frontmatter scan and for check-backlog-item. Alternatively, add a check:standards rule that every rule-emitting call site has a test referencing its message.
2. `we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs:5` — Add deterministic CLI regression tests using malformed non-colon frontmatter and asserting an actionable diagnostic and nonzero exit status for both entry points.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3335@a51aeb9e2788a232f2887b8e1610e05dde931c2c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
