---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/review-hold-reconcile.mjs", "we:scripts/lib/__tests__/gate-invariants.test.mjs", "we:scripts/conveyor/__tests__/review-hold-reconcile.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# The review-hold sweep accepts review:human plus review:changes as a valid pair

Follow-up to the operator's approval of #3657 (2026-10-03). #3657 makes a park to review:human keep an existing review:changes send-back, so human+changes is now a designed state. But planReviewHoldCleanup in we:scripts/conveyor/review-hold-reconcile.mjs (~line 107) still flags it as a contradictory verdict pair via findContradictoryReviewVerdicts, and decideContradictoryVerdictHeal returns unsupported-pair, so every sweep re-reports an entry nobody can act on (operator noise only; no label is removed). Fix: treat human+changes as valid in the contradiction check, and add a gate-invariants test that runs planReviewHoldCleanup over every label set decideParkToHuman can produce and asserts none is flagged.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
