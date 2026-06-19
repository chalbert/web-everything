---
type: idea
workItem: epic
parent: "1008"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webnotifications implementation — push-delivery provider plus intents

Implementation epic for the webnotifications standard. Design lineage: #456 / #459 / #460 (push-delivery plus notification intents). Scope: a push-delivery provider (contract to @webeverything, provider runtime to FUI) plus the notification intents. Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1064 (push-delivery contract + notification intents → @webeverything), #1065 (push-delivery provider → FUI, blockedBy #1064), #1066 (conformance demo, blockedBy #1064). #1065 and #1066 proceed in parallel after #1064.
