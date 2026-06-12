---
type: idea
workItem: story
size: 3
parent: "350"
status: open
blockedBy: ["431"]
dateOpened: "2026-06-12"
tags: []
---

# Build the v1 ingest adapters — SARIF, JUnit, coverage

Build the first ingest adapters: external format → report model for SARIF, JUnit, and coverage JSON, so any producer's output displays in the shared renderers. The lossy-normalization-hub pattern — ingest each foreign format bottom-up into the pivot the project never ships. SonarQube and lint/audit JSON follow. Phase 3 of #350; targets the report model (#431).
