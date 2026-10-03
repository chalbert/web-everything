---
bornAs: x476ixa
kind: story
size: 5
parent: "4820"
status: open
scope: ["we:scripts/lib/decision-model.mjs", "we:scripts/lib/__tests__/decision-model.test.mjs", "we:scripts/conveyor/reconcile-pass.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Trial decision models (Jev, later OpenAI Decisions API) in shadow mode on two conveyor classifications

Operator, 2026-10-03: 'Sounds good for decision apis'. Decision models (TypeSafe Jev, about 100 ms and 0.042 USD per million input tokens; OpenAI Decisions API, announced 2026-09-29, access limited) return one choice from a supplied set with a calibrated probability, no prose. Trial them in SHADOW mode only (never gating) on two repeated conveyor decisions: (1) is a CI failure flaky/infra or caused by the PR (today we:scripts/conveyor/reconcile-pass.mjs parseTimeoutFailures rules and #3559 re-runs), and (2) is a new review finding the same as an earlier one (the wording-loop problem of card 4947). Log the model's choice and probability next to today's rule outcome for a week and report agreement, cost and latency. Known risk: prompt injection can sway verdicts (VentureBeat), so PR-authored text must never make it a sole gate. Needs a Jev API key (human gate: credential); add OpenAI Decisions API when access opens.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
