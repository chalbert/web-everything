---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/operations/__tests__/codex-delivery-provider.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2900's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/codex-delivery-provider.mjs:1210` — Add a `codex sandbox -P locked` probe or test that writes `<we-lane>/.git/hooks/x` under the generated profile. If that write succeeds, add `"<we-lane>/.git/**"="deny"`, or a read-only grant plus a write entry for `backlog/**` only, alongside the `write` entry. Then pin the deny entry in a `buildNativeDenyCodexArgs` unit test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2900@9990ff189a7b3724c844c7289a042e7fffd7a521

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
