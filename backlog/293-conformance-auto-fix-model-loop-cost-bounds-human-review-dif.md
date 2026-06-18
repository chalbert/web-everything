---
type: idea
workItem: task
status: resolved
blockedBy: ["196"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Conformance auto-fix model loop — cost bounds + human-review diff + playground

The #196 model fixer (we:scripts/autofix/modelFixer.mjs) drafts missing-description njk behind the verify gate, key-gated in the CLI. Its explicit Open follow-ons remain: (1) bound model cost/iterations per failure so a runaway loop can't burn the key; (2) surface the proposed prose diff (engine already captures before/after) for human accept/revert before it lands; (3) a dev-surface/playground for the propose→verify→accept/revert loop mirroring the Code Upgrader playground, so a human can watch it interactively. Low risk, deferred from #196 — the core provider + verify-gated CREATE is shipped and unit-proven.

## Progress

- **Status:** resolved — the two headless engine/CLI deliverables shipped + unit-proven; the interactive playground (deliverable 3) spun off as **[#298](/backlog/298-conformance-auto-fix-playground-interactive-propose-verify-a/)** (demo-first UI over these pieces).
- **(1) Cost bounds:** `autofix({ maxModelFixes })` caps metered model-fixer `fix()` calls (a fixer is "model" when its id is `model:*`; reference fixers are free and uncapped). Once spent, remaining model-fixable failures are reported `deferred` — **never attempted, so no key is burned**. `result.modelFixesUsed` accounts the calls. CLI: `--max-model-fixes=N`.
- **(2) Diff + accept/revert:** `autofix({ decide })` — a review hook called for a patch that PASSED the verify gate, before it lands; returning `revert`/`false` rolls it back and records it in `reviewed` (default accepts → unchanged behaviour). New pure `lineDiff`/`formatDiff` render the captured before/after. CLI: `--review` prints each proposal's diff and reverts (inspect-only; nothing lands).
- **(3) Playground → #298:** the interactive propose→verify→accept/revert surface mirroring the Code Upgrader playground; it builds on (1)+(2), so it's a clean follow-up, not a regression.
- **Tests:** `we:scripts/autofix/__tests__/engine.test.mjs` extended — cost-bound budget/deferral, reference-free-of-budget, decide accept+revert, lineDiff/formatDiff (17 engine + 8 modelFixer = 25 pass). `check:standards` green (0 errors). CLI loads and runs (green path + flag validation).
- **Note:** an unrelated concurrent change to `we:scripts/readiness/engine.mjs` leaves one readiness test red (missing `tierBPrepared` in an expected object) — external, not from this item.
