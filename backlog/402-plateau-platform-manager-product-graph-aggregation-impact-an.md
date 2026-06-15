---
type: idea
workItem: epic
parent: "092"
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-15"
graduatedTo: none
tags: [plateau, plateau-app, platform-manager, governance, dependency-graph, enterprise, product-build]
relatedProject: webregistries
relatedReport: reports/2026-06-12-backlog-split-analysis.md
---

# Plateau platform-manager product — graph aggregation, impact analysis, governance UI, platform map

The licensed plateau-app half of the #092 ruling: cross-repo aggregation of the provider-consumer graph into one live model, plus impact analysis ('if I change X, who breaks?'), cross-team contract-drift detection, ownership/policy governance workflows, and a live platform map. Enterprise license / per-seat, bundled with continuous verification (#089 idea 1). npm+git remain the source of bytes — this tracks relationships, not packages.

> **Sliced 2026-06-12** (`/split 402`, [report](../reports/2026-06-12-backlog-split-analysis.md)). The WE-layer graph-model + seam-contract standard (#401, graduated to `webregistries`) is **resolved**, so this product is unblocked and decomposes into five plateau-app child stories: **#442** cross-repo graph aggregator (the engine, root) · **#443** impact analysis · **#444** contract-drift detection · **#445** governance UI · **#446** platform map. The aggregator (#442) is the root; the four analyses/surfaces each depend only on it and are mutually independent. #442 is workable now (the standard exists). This umbrella epic stays `open`.
