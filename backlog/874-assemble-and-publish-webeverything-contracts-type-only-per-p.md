---
type: issue
workItem: story
size: 3
parent: "872"
status: open
blockedBy: ["873"]
dateOpened: "2026-06-17"
tags: []
---

# Assemble and publish @webeverything/contracts (type-only, per-protocol subpath exports)

Build the @webeverything/contracts package: a type-only npm package re-exporting each WE protocol's pure-contract module (from #873) under a per-protocol subpath export (e.g. @webeverything/contracts/guard), so consumers import only what they use. Package name == contract specifier per #239. Keeps @webeverything reserved for standard artifacts; FUI (and any impl) depends on it (FUI→WE arrow). Type-only means zero runtime emit. Establishes the single source of truth that replaces byte-replication.
