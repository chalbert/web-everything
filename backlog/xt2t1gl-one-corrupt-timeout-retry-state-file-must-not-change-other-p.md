---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/timeout-retry-state.mjs", "we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# One corrupt timeout-retry state file must not change other PRs budgets

Follow-up from the #3559 advisory (2026-10-02). we:scripts/conveyor/timeout-retry-state.mjs:13 readTimeoutStates parses every json file in the state directory when a PR canonical file is absent, so one corrupt or foreign-version file turns every red PR budget into pending. Scope corruption errors to files whose evidence matches (repo, pr, head); regression test that an unrelated corrupt file does not change another PR budget.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
