---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xbz5gr6-codex-build-fix-jobs-run-in-a-sandbox-that-cannot-verify-or.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3187's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xbz5gr6-codex-build-fix-jobs-run-in-a-sandbox-that-cannot-verify-or.md:14` — Add a required 'sandbox widening' checklist to the card template for any item touching sandbox or permission flags: least-privilege scope, egress allowlist, and a negative test proving the boundary still holds. Enforce it as a check:standards rule that fails if a card scoped to a sandbox script has a TODO Done-when. Also add a test in we:codex-direct-task.test.mjs asserting review mode args are unchanged and that build mode does not pass an unrestricted network flag.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3187@bfad9092e86a63f0068c234af5cbcfecce277a11

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
