---
bornAs: x5ohyuu
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2880's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/promote-draft-pr-dispatch.mjs:131` — Extend the `check:standards` implicit-repo scanner (`multi-repo-checks`) to require that `gh` providers always receive an explicit repo, with no per-repo `undefined` branch. The alternative is to have `createDraftPromoteProvider` throw when `repo` is missing.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2880@bc569327804bb98edc5599e0697a0c8abac00e78

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
