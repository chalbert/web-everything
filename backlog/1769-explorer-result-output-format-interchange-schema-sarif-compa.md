---
kind: story
size: 5
status: open
dateOpened: "2026-06-24"
tags: []
---

# Explorer result/output-format interchange schema (SARIF-compatible core + extension slot)

The one WE artifact minted by #1747 (explorer is otherwise a closed Plateau product). Specify a finding/report interchange schema — severity, location, oracle id, evidence, run/coverage summary — so any tool or CI can consume explorer output without depending on the closed product. Per #1467 (WE keeps the contract, not the engine); the temporal rule is satisfied by convergent external prior art (SARIF, axe-core JSON, Lighthouse JSON), so mint a SARIF-compatible core now + an open extension slot for WE-specific fields (oracle ids, conformance-vector linkage). Distinct from the conformance binding interface (#1596). The Plateau explorer's reportBundle emits to this schema; third-party tools read it.
