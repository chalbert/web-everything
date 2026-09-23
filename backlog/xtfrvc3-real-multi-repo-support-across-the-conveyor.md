---
kind: epic
parent: "3383"
status: open
relatedReport: reports/2026-09-23-conveyor-multi-repo-gap-map.md
dateOpened: "2026-09-23"
tags: []
---

# Real multi-repo support across the conveyor

Operator directive 2026-09-23: we need real multi repo support. The conveyor serves the three constellation repos but was built WE-first: review, verify and the drain work for all three; fix and CI-heal never run for frontierui or plateau-app (plateau #170/#171 sat at review:changes with nothing fixing them); the review wrapper, lane capacity and lease reaping assume the WE pool. Root causes and the design (a per-repo profile in we:scripts/lib/constellation-repos.mjs, a PR-to-work-unit resolver, one repo-aware brief contract, one shared repo loop, capability-gated refusal) are in we:reports/2026-09-23-conveyor-multi-repo-gap-map.md. Children: one decision card for the forks, ten build slices.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
