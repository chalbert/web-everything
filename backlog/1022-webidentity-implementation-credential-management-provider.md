---
type: idea
workItem: epic
parent: "1008"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:identity/contract.ts"
tags: []
---

# webidentity implementation — credential-management provider

Implementation epic for the webidentity standard. Design lineage: #012 / #482 / #483 (credential-management protocol plus thin intent). Scope: a credential-management provider (contract to @webeverything, provider runtime to FUI) over the Credential Management API. Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1060 (credential-management contract → @webeverything), #1061 (provider over the Credential Management API → FUI, blockedBy #1060), #1062 (conformance demo, blockedBy #1060). #1061 and #1062 proceed in parallel after #1060.
