---
type: idea
workItem: story
size: 3
parent: "351"
status: resolved
blockedBy: ["436"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webcompliance/gate.ts
tags: []
---

# Build the compliance gates — CI runners that block on a policy violation

Build the gate runners that fail CI / block on a policy violation — the escalation of a conformance score to a hard rule. Generalizes the benchmark's --strict seed into a declared, severity-aware gate driven by the policy model. Phase 2 of #351; consumes the policy model (#436).
