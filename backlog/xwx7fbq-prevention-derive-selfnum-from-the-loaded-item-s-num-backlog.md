---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Derive selfNum from the loaded item's num (backlog.find by id) or the shared ID_TOKEN, and add a hash-i… (from chalbert/web-everything#3326 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:989` — Derive selfNum from the loaded item's `num` (backlog.find by id) or the shared ID_TOKEN, and add a hash-id fixture test. A lint banning ad-hoc `^(\d+)-` filename parsing in we:scripts/check-standards.mjs would also cover the class.
2. `we:scripts/__tests__/check-standards.test.mjs:603` — Store the baseline in a committed file and have the test fail only on increases from touched cards, or scope the ratchet to cards changed in the diff.
3. `we:scripts/check-standards.mjs:989` — Add a deterministic integration test asserting that a hash-prefixed card referencing itself in deferredBlockedBy produces a standards error; extract self IDs using the repository's canonical numeric/hash ID parser.
4. `we:scripts/check-standards.mjs:989` — A unit test in `we:scripts/__tests__/check-standards.test.mjs` asserting that a hash-prefixed item flags a self-edge when its hash is present in its own `deferredBlockedBy` array.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3326@68cb4a99f739e457e61571d13ee1f415964c5f5b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
