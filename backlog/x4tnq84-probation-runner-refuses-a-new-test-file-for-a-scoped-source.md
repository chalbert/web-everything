---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Probation runner refuses a new test file for a scoped source; prepare should declare test paths

Live 2026-09-30: we:scripts/operations/probation-build-run.mjs ran #4389 (bugfix, Codex; scope we:scripts/merge-ai-prs.mjs). Codex added the regression test we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs, and the runner abandoned the whole build as gate-red at its out-of-scope check (~line 442) — the work was thrown away although a new test for the scoped file is exactly what the brief asks for. Root cause is two-sided: prepare stamps a scope with no test path, and the runner has no notion of a scoped source owning its tests. Fix: (1) the prepare brief/stamp requires the test file(s) in scope (existing or new, e.g. a we:scripts/__tests__/<name>*.test.mjs pattern); (2) the runner treats a NEW test file whose name starts with a scoped source basename, under the matching __tests__ dir, as in scope, and still refuses any other path. Proof: re-run #4389 and show it builds; show an unrelated out-of-scope edit is still refused.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
