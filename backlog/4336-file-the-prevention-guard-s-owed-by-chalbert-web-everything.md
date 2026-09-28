---
bornAs: xx9swng
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/__tests__/queue-store.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2816's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/queue-store.mjs` — Publish migration with atomic create-if-absent semantics and add a deterministic test that creates a modified canonical queue between the initial existence check and publication, asserting that migration preserves it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2816@d338d13d77fd3d1f95a2e8c5c598dd1dbf1226b8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
