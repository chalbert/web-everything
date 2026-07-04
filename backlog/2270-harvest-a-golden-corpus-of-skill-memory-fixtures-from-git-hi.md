---
kind: story
size: 5
parent: "2268"
status: open
dateOpened: "2026-07-04"
tags: []
---

# Harvest a golden corpus of skill/memory fixtures from git history

An idempotent miner that turns project history into replayable fixtures: each historical backlog create/resolve/settle, each memory add/change, and each hook-triggering commit (locus prefix, guard-bash, guard-lane) becomes an input+expected-output case. v1 mines a curated high-signal seed set; full-history sweep is a follow-on. The corpus is the shared fuel for both harness tiers.
