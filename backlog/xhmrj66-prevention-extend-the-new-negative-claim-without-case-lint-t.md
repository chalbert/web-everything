---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Extend the new negative-claim-without-case lint to scan MVP and Musts sections, or have prepare require… (from chalbert/web-everything#3291 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4374-route-review-seats-by-risk-to-antigravity-claude-sonnet-4-6.md:56` — Extend the new `negative-claim-without-case` lint to scan MVP and Musts sections, or have prepare require a Test-plan row for every Must line.
2. `we:scripts/check-standards-rules.mjs:1050` — Add a unit test with a bulleted Design, and make the paragraph splitter flush on list-item starts.
3. `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:708` — A coverage threshold (e.g., 100% branch coverage on new logic) or a mutation-testing gate would require the filter conditions to be exercised by a test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3291@877ebb2b0b4b6f7f57f6191547d08d538f056c64

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
