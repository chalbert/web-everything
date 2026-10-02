---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# The operation runner refuses a mutating operation from a checkout that is behind main

Live case 2026-10-02: the orchestrator job scripts called we:scripts/operations/run.mjs verify and open-pr from the operator primary checkout, which was 1,427 commits (3 days) behind main, so every verify and open-pr fix since then (including #3437, failing tests named) silently did not apply; two verifies of the #3432 loop fix went red with no test named and passed once run from an up-to-date lane. The dispatch paths already refuse a stale checkout (#3439), but the operation runner does not. Fix: the runner checks how far the checkout is behind main (fetching only when the cached ref is a few minutes old) and refuses a mutating operation when it is behind and is not a lane or daemon clone, naming the count and telling the caller to run from a lane; read-only operations still run with a one-line warning; an explicit, logged override exists for deliberate use. Test: a fixture checkout behind main refuses verify and open-pr, allows a read-only operation with a warning, and a lane passes.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
