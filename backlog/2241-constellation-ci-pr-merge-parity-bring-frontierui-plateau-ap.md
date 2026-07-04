---
kind: epic
status: open
dateOpened: "2026-07-04"
tags: []
---

# Constellation CI + PR-merge parity — bring frontierui & plateau-app up to webeverything's transport

frontierui and plateau-app have neither CI nor the self-approved PR-merge transport WE has, so AI PRs pile up unlanded and unvalidated (11 FUI PRs sat with no test gate, landed 2026-07-03 on GitHub mergeability alone). Both repos DO have test scripts (FUI: vitest + check:standards + playwright + explorer gate; plateau: vitest + render-conformance + playwright) — they just have no workflow to run them and no drain/merge/pr machinery. Bring both to parity: a required CI test check + the ported transport (we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs) + the drain/merge/pr skills + matching branch protection (0 reviewers, required test check).
