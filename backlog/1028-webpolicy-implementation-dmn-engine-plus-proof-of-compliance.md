---
kind: epic
parent: "1008"
status: resolved
dateOpened: "2026-06-19"
dateResolved: "2026-06-20"
graduatedTo: "we:webpolicy/contract.ts"
tags: []
---

# webpolicy implementation — DMN engine plus proof-of-compliance

Implementation epic for the webpolicy standard. Design lineage: #406 / #407 / #408 (DMN meta-schema plus proof plus enforcement seam). Scope: a DMN engine plus proof-of-compliance (contract to @webeverything, engine runtime to FUI). Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1077 (DMN contract / meta-schema → @webeverything), #1078 (DMN engine + proof-of-compliance runtime → FUI, blockedBy #1077), #1079 (conformance demo, blockedBy #1077). #1078 and #1079 proceed in parallel after #1077.
