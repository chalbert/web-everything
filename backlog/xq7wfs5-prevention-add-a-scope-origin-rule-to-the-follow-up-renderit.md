---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/x762296-sanitize-ci-log-test-names-before-they-reach-an-auto-filed-c.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a scope-origin rule to the follow-up renderItem hardening: auto-filed scope entries must be interse… (from chalbert/web-everything#3730 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/x762296-sanitize-ci-log-test-names-before-they-reach-an-auto-filed-c.md` — Add a scope-origin rule to the follow-up renderItem hardening: auto-filed scope entries must be intersected with files in the PR diff or an allowlist. Back it with a deterministic test that a syntactically valid but unrelated path is dropped.
2. `we:backlog/x762296-sanitize-ci-log-test-names-before-they-reach-an-auto-filed-c.md` — Define the sanitizer as an allowlist (letters, digits, and a small punctuation set) or defang `://`, `www.`, `@` and leading `#` explicitly. Add table cases for each to the sanitizer test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3730@04032a41e053502bf2cd10ad35daa3ec93c3c6e8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
