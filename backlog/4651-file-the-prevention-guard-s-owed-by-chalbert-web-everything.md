---
bornAs: xn7j0xw
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3163's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md:5` — Card-lint rule in check:standards: if the body names a fix across several files or a 'Proof' requiring tests, require the scope to include a test path or a __tests__ glob (the same rule this card wants the prepare step to enforce).
2. `we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md:16` — Add a check:standards rule that rejects a card with status open and the literal scaffold 'Executable — TODO' line at file/land time, or that requires a named test for any stated refusal guarantee.
3. `we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md:13` — Require implementation of the runner rule to carry table-driven negative tests: traversal, prefix-sibling, wrong extension, modified-not-new, wrong directory. Fill the "Done when" Executable item with that test command.
4. `we:backlog/4650-probation-runner-refuses-a-new-test-file-for-a-scoped-source.md:5` — A pre-commit hook or lint rule that cross-references scripts mentioned in the card's problem statement/fix steps against the `scope` frontmatter array to ensure all required files are permitted.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3163@0d9d0d46a82bf7a34e0a97fae445d521cdb978c7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
