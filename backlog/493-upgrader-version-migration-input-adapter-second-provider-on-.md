---
type: issue
workItem: story
size: 3
parent: "097"
status: open
blockedBy: ["491", "492"]
dateOpened: "2026-06-13"
tags: []
---

# Upgrader version-migration input adapter — second provider on upgraderEngine, verifyUpgrade-gated

Build slice (c) of the ratified #191 version-migration upgrader (Fork 1A). Wire the version-migration kind as a SECOND provider into the upgrader's devtools provider seam (NOT a runtime registry — see #191's reframe): an input adapter that consumes already-conformant source + a changelog-manifest delta, drives the planner (slice a) → declarative interpreter (slice b) → existing `verifyUpgrade` gate, so migrated call sites are only offered when they re-parse, round-trip, and conform. One engine, two input adapters (legacy→standard from #094, version→version here), no second tool, no drift. Blocked on a (plan) + b (interpreter). Align with the analyzer-seam cleanup if that lands first.
