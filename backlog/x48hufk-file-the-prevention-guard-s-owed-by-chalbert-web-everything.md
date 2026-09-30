---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/machine-pr-title.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/__tests__/machine-pr-title.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3200's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/machine-pr-title.mjs:7` — Add a test that feeds every title-reading extractor in we:lib/open-pr-items.mjs a card title with paren-hash and similar shapes. Alternatively, have cleanTitle strip `(` and `)` or any x[0-9a-z]{6} token. Both are deterministic gates.
2. `we:scripts/operations/deliver-item-wrapper.mjs:2148` — A `check:standards` lint rule forbidding `execFileSync` calls without an explicit `encoding` option, ensuring string operations don't unexpectedly receive Buffers.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3200@8a8a59c9f020a1705f602460b307435f3f601cc8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
