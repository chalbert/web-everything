---
kind: epic
parent: "xhmav8a"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Constellation CI + PR-merge parity — bring frontierui & plateau-app up to webeverything's transport

frontierui and plateau-app have neither CI nor the self-approved PR-merge transport WE has, so AI PRs pile up unlanded and unvalidated (11 FUI PRs sat with no test gate, landed 2026-07-03 on GitHub mergeability alone). Both repos DO have test scripts (FUI: vitest + check:standards + playwright + explorer gate; plateau: vitest + render-conformance + playwright) — they just have no workflow to run them and no drain/merge/pr machinery. Bring both to parity: a required CI test check + matching branch protection (0 reviewers, required test check), and a way to open + land gated self-approved PRs.

## Architecture decision (2026-07-04, user directive "1 skill") — central lander, not per-repo copies

The original plan copied the transport + `/drain` `/merge` `/pr` skills **into** each repo. Ruled against, for two reasons: (1) the user wants ONE `/drain` skill, not three; (2) it is **incorrect** — independent per-repo drains each see only their own repo, so they cannot honour **cross-repo `blockedBy`** (the backlog is WE-global, dependencies flow WE→FUI→plateau, so a frontierui PR can be blocked by a WE item). Ordering a cross-repo dependency needs ONE sequencer that sees all repos. So the LANDER is centralized: #2257 makes we:scripts/merge-ai-prs.mjs repo-aware (`--all-repos`), and `/drain` sweeps all 3 repos in one global cascade. What remains per-repo and unavoidable: the **CI required `test` check** (#2242/#2243) and **branch protection** (#2246) — GitHub blocks a merge without them regardless of design. The **producer** side (`we:scripts/pr-land.mjs` + `/pr`) is the residual of #2244/#2245 (now re-scoped): likely also centralized via `--repo` rather than copied.
