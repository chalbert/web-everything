---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/backlog/scaffold.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/backlog/__tests__/scaffold.test.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — A semantic test that asserts the provided hint string satisfies the lint rule it describes, ensuring al… (from chalbert/web-everything#3222 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/backlog/scaffold.mjs` — A semantic test that asserts the provided hint string satisfies the lint rule it describes, ensuring alignment between guidance and enforcement.
2. `we:scripts/check-standards-rules.mjs` — A mutation testing tool (like Stryker) integrated into CI that fails if regular expression branches can be removed without failing tests.
3. `we:scripts/check-standards-rules.mjs:1113` — A lint rule banning negative state exclusions (`!== 'resolved'`) in state machines, requiring explicit positive matching (`['open', 'active'].includes(status)`).
4. `we:scripts/backlog/scaffold.mjs:15` — A test asserting that the hint text itself, or a direct translation of its instructions, contains the required vocabulary to pass the linter.
5. `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:730` — A testing standard requiring custom regex logic with AND constraints to have explicit negative tests for each independent operand failing (partial bounds).
6. `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:738` — A coverage rule requiring all captured OR branches in a boundary-stopping regex to be explicitly exercised by the test suite.
7. `(no file cited)` — A lint rule or review checklist requiring boundary and negative test cases for all text-proximity heuristics.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3222@2e94e62e589abd9a81eb236f28035bc54b84bade

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
