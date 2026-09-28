---
kind: task
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Harden the two probation run scripts against a worker planting a git hook or gitignored config

we:scripts/operations/probation-heal-run.mjs and we:scripts/operations/probation-build-run.mjs both run an untrusted model (Codex/Antigravity) with filesystem write access inside a real git lane, then run git commit and verify-lane in that same lane. Neither inspects gitignored files or .git/hooks/, so a hostile or mistaken spec could plant a pre-commit hook or a config file the gate loads, which then executes with the launcher's own credentials at commit/gate time. Sandbox both run scripts against this (e.g. a pre-worker snapshot + post-worker scan of .git/hooks and known gate-loaded config paths, refusing the launch if any changed) or scope down what the worker's own launcher script grants. Flagged repeatedly by the converge panel on #4291's plan review (security lens, present since round 4).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
