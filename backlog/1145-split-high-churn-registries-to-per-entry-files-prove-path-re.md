---
type: idea
workItem: story
size: 5
parent: "1143"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Split high-churn registries to per-entry files (prove path: researchTopics + intents)

Split the two highest-churn monolithic registries — we:src/_data/researchTopics.json (133 entries, very high churn from /prepare + /decision) and we:src/_data/intents.json (56 entries) — into per-entry files under we:src/_data/researchTopics/ and we:src/_data/intents/, each with a *.js loader that globs+aggregates (exact pattern already proven by we:src/_data/blocks/*.json + its loader, and backlog/*.md). Rendering/consumers stay unchanged (loader returns the same array). Kills the splice-only mixed-escaping footgun and converts 'everything serializes on this file' into 'disjoint entries merge clean'. Proves the loader + gate path before the rest (S3).
