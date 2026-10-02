---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# A PR drafted as withdrawn stays a draft: promote-draft must never re-ready it

Live case 2026-10-02: the orchestrator paused PR #3432 (a review loop) with the sanctioned fix-begin --draft --reason=withdrawn at 11:26 AM ET. When that fix claim expired, promote-draft saw a draft with green required checks and made it ready again, and the review loop resumed (about 5 more runs) until a stand-down was used instead. A withdrawal is a deliberate hold, not a draft-first PR waiting for CI. Fix: we:scripts/operations/promote-draft-pr-dispatch.mjs (and the reconcile planner that plans it) never promotes a PR carrying the withdrawn draft-reason label, and the withdrawal outlives the claim TTL until explicitly lifted. Replay #3432.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
