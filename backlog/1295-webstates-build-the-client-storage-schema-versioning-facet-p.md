---
kind: story
size: 8
status: open
dateOpened: "2026-06-20"
tags: []
---

# webstates: build the client-storage schema-versioning facet (per-key envelope default)

Implement the #1251-ratified versioning facet above CustomStorageStrategy: a thin engine-agnostic wrapper on the strategy read/write path that detects when stored client state predates the reading schema and either runs a registered migration or discards to defaults. Default detection = version stamp; default mismatch policy = discard→defaults; default granularity = per-key {v,data} envelope (per-store single-sidecar opt-in). Read-time/lazy application riding the registry's IndexedDB→localStorage degrading read path (#1108). Home = webstates. Fixes the #487 stale-filter-state footgun generically.
