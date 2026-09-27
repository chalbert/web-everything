---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/dispatch-providers/probation-worker.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Probation launcher for doc-fix builds

PR #2819 opened the model-probation gate for doc-fix and ci-heal picks. ci-heal already has a real launcher (we:scripts/lib/probation-launcher.mjs, we:scripts/operations/probation-heal-run.mjs) that runs the picked worker synchronously via we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs and posts a scorecard row with the #2815 executor field. doc-fix picks are only recorded today -- Claude still runs every doc-fix build regardless of the pick. Build the doc-fix launcher so a non-critical doc-fix build actually dispatches to its picked provider (Antigravity-Claude or Codex): extend we:scripts/lib/probation-launcher.mjs and add a doc-fix worker under we:scripts/operations/dispatch-providers/probation-worker.mjs, synchronous via we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs, with the same size cap and executor field the ci-heal launcher already writes. Builds on PR #2819. Why: the operator wants other models to earn more of the real work over time as trial data supports it; promotion out of probation stays an explicit human decision, never automatic.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
