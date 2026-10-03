---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:config/platformDefaults.ts", "we:config/defineConfig.ts", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:skills-src/conveyor/delivery-agent-brief-v2.md", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Configurable verify mode for agent pushes: parallel for PR fixes, local-first for initial builds

Operator ruling 2026-10-03: the order of local tests and CI before an agent pushes is a configurable policy. Measured that day: PR CI p50 14 min / p90 16; local verify p50 2 / p90 8 min (selected tests). Today a fixer runs local verify, then pushes, then waits for CI, so the times add up. Setting verifyMode with values local-first, ci-only, parallel, keyed by job kind. Defaults: fix, conflict repair and ci-heal = parallel (push at once, run local verify alongside; a local red makes the fixer fix and re-push, superseding the stale CI run); initial build = local-first. Declare it per we:config/platformDefaults.ts and we:config/defineConfig.ts (config-extends-platform-default). Wire it into we:skills-src/conveyor/fix-agent-brief.md, we:skills-src/conveyor/fix-agent-ci-brief.md and we:skills-src/conveyor/delivery-agent-brief-v2.md. Guard: while a fixer holds its fix claim, a red CI on the pushed head must not dispatch a ci-heal (we:scripts/conveyor/reconcile-fix-dispatch.mjs). Done when: unit tests cover each mode and the claim guard; live proof on one real conflict repair shows push-to-CI time before and after.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
