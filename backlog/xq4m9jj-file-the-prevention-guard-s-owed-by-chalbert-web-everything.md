---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/lib/__tests__/citation-check.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3127's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/citation-check.mjs:1157` — Add a deterministic regression test accepting an existing relative destination containing balanced parentheses, and parse destinations with balanced-delimiter handling.
2. `we:scripts/lib/citation-check.mjs:1157` — Add unit test coverage for all valid Markdown link title formats (single quotes, parens) to ensure the regex captures them.
3. `we:scripts/lib/citation-check.mjs:1154` — Use a real Markdown AST parser (like remark) for link extraction instead of regexes, or explicitly regex-strip 4-space indented lines before link matching.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3127@7bf08ac16905690343640b6f55d3812b1fcbfe5c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
