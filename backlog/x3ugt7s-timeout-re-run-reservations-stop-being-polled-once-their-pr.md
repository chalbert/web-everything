---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Timeout re-run reservations stop being polled once their PR closes or ages out

Follow-up from the #3559 advisory (2026-10-02). we:scripts/operations/ci-heal-pr-dispatch.mjs:490 flushTimeoutFollowups re-observes every unresolved pending reservation (three GitHub reads each) on every reconcile tick, with no PR-open or age bound, spending GitHub budget on dead entries. Retire entries whose PR is closed or merged or whose age passes a cap; test that a closed PR pending state stops polling.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
