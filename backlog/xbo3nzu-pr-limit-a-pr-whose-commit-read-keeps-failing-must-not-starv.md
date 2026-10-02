---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# pr-limit: a PR whose commit read keeps failing must not starve later PRs of authorship resolution

Follow-up from the #3215 advisory (2026-10-02, accepted by the operator). we:scripts/lib/pr-limit.mjs:232 and :202: a PR whose commits read fails persistently is never cached, so it burns the per-round GitHub budget every round; if the first three uncached PRs keep failing, every later PR is starved and counted toward the limit as unresolved. Fix: negative-cache a failed read with a cooldown, or rotate the order across rounds. Test: three persistently failing leading PRs and resolvable trailing ones; calls stay bounded and every trailing PR is eventually resolved.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
