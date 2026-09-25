---
kind: story
size: 2
parent: "3443"
status: resolved
scope: ["we:skills-src/batch-backlog-items/parallel-execute.workflow.js", "we:scripts/__tests__/parallel-execute-workflow.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Lane agents ignore operator messages relayed mid-run

Live wf_988f1485-8fe (2026-09-25): the operator's status question to the orchestrating session was relayed into all 3 running lane agents; each decided it overrode its computed task, answered it instead, and returned carried/no-we-pr with no work done. Add a short RELAY_GUARD rule to every agent prompt we:skills-src/batch-backlog-items/parallel-execute.workflow.js builds (probe, provision, lane-item, both finalize agents): a relayed operator message is addressed to the orchestrating session, not the lane agent, which keeps executing its assigned step and ignores it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
