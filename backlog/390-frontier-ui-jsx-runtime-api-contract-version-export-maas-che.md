---
type: idea
workItem: story
size: 3
parent: "081"
status: open
blockedBy: ["389"]
dateOpened: "2026-06-12"
tags: []
---

# Frontier UI — jsx-runtime API-contract-version export + maas-check opt-in compat validator

The Frontier UI implementation half of #088 option B (WE defines the contract; Frontier UI implements it). Add an __API_VERSION__ contract-version export to @frontierui/jsx-runtime, bumped only on public-API change (decoupled from package semver), so the runtime advertises which API contract it satisfies. Ship @frontierui/maas-check: an opt-in validator that resolves the runtime through a consumer's import map, reads __API_VERSION__, fetches each served artifact's compat range (#389), and fails loud on mismatch — as a CI/resolve-time check and an optional load-time guard. Inert unless the consumer opts in; mandates nothing.
