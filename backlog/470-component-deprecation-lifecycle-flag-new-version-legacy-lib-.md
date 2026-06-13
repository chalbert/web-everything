---
type: idea
workItem: story
size: 3
parent: "099"
status: open
dateOpened: "2026-06-13"
tags: []
---

# Component deprecation lifecycle — flag → new-version → legacy-lib, support-preserving adapters

Explicit deprecation lifecycle pattern: flag a component → ship new version → preserve legacy via adapters/legacy-lib, v2 components. Versioning identity is already covered (#088, #102, #191, #389/#390); only the deprecation lifecycle pattern is unwritten. Companion to #102 (changelog manifest) + #191 (codemods). From #111 triage.
