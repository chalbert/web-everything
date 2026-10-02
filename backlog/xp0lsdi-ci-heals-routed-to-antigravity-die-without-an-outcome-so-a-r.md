---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/lib/provider-quota-hold.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# CI heals routed to Antigravity die without an outcome, so a red PR is held instead of healed

Live case 2026-10-01: PR #3373 (soak-replay-gate red since 5:22 PM ET) got two CI heals dispatched as model=claude-sonnet-4-6 executor=antigravity (handles pid 43273 and 94262). Both processes are gone with no outcome, and the review daemon still reports "0 of 3 CI-heal attempts are spent, nothing live is working it"; the fix daemon now refuses the PR as held. Antigravity Claude usage ran out earlier that afternoon (operator report), so the executor likely exits at once. Find where the launch outcome is lost (we:scripts/operations/dispatch-lane.mjs detached launch, the attempt ledger, we:scripts/lib/provider-quota-hold.mjs), make an executor that exits without settling count as a failed attempt with its cause, and route the retry to a provider with quota. Replay #3373.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
