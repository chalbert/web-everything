---
kind: story
size: 2
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Sending a review:human PR back for changes leaves it with no contradictory label pair, so the fixer picks it up

Live case 2026-10-01: PR #3215 carries review:changes AND review:human after the operator said "send back"; the review daemon logs "hold-reconcile FLAGGED contradictory review:changes,review:human — not auto-resolved (unsupported-pair)" every tick, so no fixer is ever dispatched and the PR sits. Fix: we:scripts/review-set-label.mjs --to=changes on a review:human PR removes review:human (the human ceremony is re-required on the next pass by the escalation scoring), and the hold reconciler resolves an existing changes+human pair the same way (changes wins). Replay #3215.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
