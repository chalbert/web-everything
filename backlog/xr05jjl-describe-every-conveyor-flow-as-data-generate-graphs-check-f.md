---
kind: story
size: 8
parent: "4075"
status: active
scaffoldedBy: "flows-describe-4075"
dateScaffolded: "2026-09-26"
scope: ["we:scripts/conveyor/flows/README.md", "we:scripts/conveyor/flows/flow-model.mjs", "we:scripts/conveyor/flows/check.mjs", "we:scripts/conveyor/flows/graph.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Describe every conveyor flow as data, generate graphs, check for gaps

Step 1 of the operator-approved plan after 2026-09-26's knock-on daemon breaks (cwd moved to scratch broke lane edit permission after #2701; the off-lock smoke in #2731 broke the candidate env; a retargeted stacked PR never re-ran CI; states with no owner; waits with no bound). Describe-only: one JSON flow file per flow under we:scripts/conveyor/flows/ (build-dispatch, fix, ci-heal, review, drain-land, conflict, daemon-rebuild, session-cleanup, lane-lifecycle) recording per state its owner, waits+timeouts, retries+caps, escalation, and per step its assumptions and provisions, all cited file:line. we:scripts/conveyor/flows/graph.mjs emits Mermaid+JSON per flow and combined; we:scripts/conveyor/flows/check.mjs flags no-owner, unbounded waits, failures with no exit, and assumptions no earlier step provides on every path (must-analysis). CI gate: we:scripts/conveyor/flows/__tests__/real-flows.test.mjs fails on unacknowledged findings. Nothing executes from the flow files yet (see the workflow-manager decision card).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/flows/__tests__/flow-model.test.mjs we:scripts/conveyor/flows/__tests__/regressions.test.mjs` passes (red→green on a gappy fixture; #2701 / #2731 / #2729 / 93b2d603a / 759529ac0 reconstructions flagged on the broken side only), and `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` passes: nine flows, every WE cite resolves, no unacknowledged finding.
2. **Report** — `node we:scripts/conveyor/flows/check.mjs` over the real flows is pasted in the PR with each finding mapped to a filed card; one rendered Mermaid graph is in the PR body.
