---
bornAs: x9mr5is
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# The disjoint-closure check treats a deleted dependency as touching the failing test

Follow-up from the #3559 advisory (2026-10-02). we:scripts/conveyor/reconcile-pass.mjs:1257: deleting a dependency can change import resolution (an extensionless import falling back to another file) while still passing the check that a failing test is untouched by the PR. Conservatively treat a source deletion as touching any test until resolution is compared against the base; deterministic classifier regression for deleted dependencies with resolution fallbacks.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
