---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# pr-limit: authorship cache must invalidate when the PR base changes

Follow-up from the #3215 advisory (2026-10-02). we:scripts/lib/pr-limit.mjs:194 caches authorship verdicts by head alone; retargeting a PR to another base without a new head changes its commit range but reuses the stale verdict indefinitely. Fix: include base identity in the cache key. Test: same head, changed base and commit range, verdict recomputed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
