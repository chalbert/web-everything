---
type: idea
workItem: epic
parent: "1008"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webrealtime implementation — transport-negotiation runtime

Implementation epic for the webrealtime standard. Design lineage: #458 (transport-negotiation protocol). Scope: a transport-negotiation runtime (contract to @webeverything, runtime to FUI) that negotiates WebSocket / SSE / WebTransport behind one contract. Carved from the #1008 concept-to-built triage roadmap.

**Sliced** into the contract/provider/demo trio: #1067 (transport-negotiation contract → @webeverything), #1068 (negotiation runtime over WebSocket / SSE / WebTransport → FUI, blockedBy #1067), #1069 (conformance demo, blockedBy #1067). #1068 and #1069 proceed in parallel after #1067.
