---
type: idea
workItem: story
size: 5
parent: "1143"
status: open
blockedBy: ["1145"]
dateOpened: "2026-06-19"
tags: []
---

# Split remaining churned registries (protocols, demos, semantics, assemblerPresets)

After S2 (#1145) proves the loader+gate path, apply the same per-entry split to the remaining agent-churned monolithic registries: we:src/_data/protocols.json (32), we:src/_data/demos.json (31), we:src/_data/semantics.json (194), we:src/_data/assemblerPresets.json (~200). Same pattern: per-entry files + globbing *.js loader, consumers unchanged. Leave low-churn small singletons (adapters, capabilityMatrix, projects, chrome) as-is — splitting them buys negligible parallelism. blockedBy #1145 so the pattern is settled once.
