---
kind: epic
parent: "1008"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:manifests/changelog-contract.ts"
tags: []
---

# webmanifests implementation — changelog-manifest contract and reader

Implementation epic for the webmanifests standard. Design lineage: #102 changelog-manifest protocol. Scope: the manifest contract (to @webeverything) plus a reader runtime (to FUI). Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1057 (changelog-manifest contract → @webeverything), #1058 (reader runtime → FUI, blockedBy #1057), #1059 (conformance demo, blockedBy #1057). #1058 and #1059 proceed in parallel after #1057.
