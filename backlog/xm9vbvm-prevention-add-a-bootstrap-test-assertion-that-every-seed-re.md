---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4281-pr-ledger-slice-2a-derive-per-pr-state-from-the-webhook-even.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a bootstrap test assertion that every seed record is rejected by isRelevantEvent for all roles. Add… (from chalbert/web-everything#3362 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4281-pr-ledger-slice-2a-derive-per-pr-state-from-the-webhook-even.md` — Add a bootstrap test assertion that every seed record is rejected by `isRelevantEvent` for all roles. Add a card-review lens question: 'what new records land on an existing feed, and who filters them?'
2. `we:backlog/4281-pr-ledger-slice-2a-derive-per-pr-state-from-the-webhook-even.md` — Add a card-template check that every 'cannot/never grants' auth claim in a prepared card maps to a named negative test: no binding, empty header, wrong credential class. Failing that, add a shared auth-helper unit test that rejects an empty or undefined expected token for every route.
3. `we:backlog/4281-pr-ledger-slice-2a-derive-per-pr-state-from-the-webhook-even.md` — Add a prepare-card checklist item: every new write endpoint and persistent table declares a max payload size and row bound, with a test for the rejection path.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3362@10e3e7bc288c3d0a86c419ab14268ef0fe447d77

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
