---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-patch-equivalence.mjs", "we:scripts/lib/__tests__/git-patch-equivalence.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2938's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/git-patch-equivalence.mjs:42` — A linter rule (e.g., eslint-plugin-sonarjs `no-redundant-boolean`) could flag redundant boolean expressions where one side encompasses the other.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2938@4a3361149339032fbc49559d99e1a6772d4416ca

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
