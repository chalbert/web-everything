---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# A PR with no review label after a CI heal is re-armed, never left invisible

Live case 2026-10-01: PR #3239 was rebased and CI-healed at 2:12 PM ET; afterwards it carries NO review:* label, so neither the review daemon nor the fix daemon ever considers it again and it sat for 3.5+ hours. Fix: after a ci-heal re-push (we:scripts/operations/ci-heal-pr-dispatch.mjs) re-arm review:pending when the PR has no review:* label, and the reconcile pass (we:scripts/conveyor/reconcile-core.mjs) flags any open agent PR with no review:* label for longer than one tick as a health episode. Replay #3239.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
