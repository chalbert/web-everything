---
bornAs: xwq6ubw
kind: story
size: 5
parent: "4673"
status: open
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Routing pilot stage 0: join every model call to its card, step and attempt

Operator ruling on #4673 (option b narrowed, 2026-09-30): before any savings claim, every worker, checker, review and retry call must be attributable to one card, step and attempt, and record the requested AND served model, backend and effort. Today 687 of 691 token-bearing scorecard rows lack an item id and orchestration subagents cannot be attributed (we:reports/2026-09-30-model-routing-strategy.md). Extend the run records and we:scripts/conveyor/run-rating.mjs coverage so a pilot cohort cost can be computed from records alone; preserve missing values as unknown, never zero.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
