---
kind: story
size: 3
parent: "x8lajxj"
status: open
scope: ["we:scripts/lib/review-policy.contract.json", "we:scripts/lib/review-policy.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Jury config contract: care-to-jury table with per-item override

The foundation slice. Extend `we:scripts/lib/review-policy.contract.json` with the care→jury table — per care band: which lenses fan out, which validation methods each pulls in, `jurorsPerLens`, and the `roundCap` (max round-trips before deadlock→human). Add the roster-timing-mode field (knob #4). Extend `validateContract` in `we:scripts/lib/review-policy.mjs` to cover the new shape. The contract is statute/gate-self (a human edits the review leash); an item file may carry only *overrides*, same pattern as `scope:`. This single-sources today's hardcoded `panelRigorForCareLevel` bands (`we:scripts/lib/review-core.mjs`) so a re-tune is one human-gated edit, not scattered constants.
